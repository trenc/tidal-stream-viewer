// Browser acceptance test for the offline download, against the served
// production build (public_html via the Docker webserver) with a real
// service worker. Drives Firefox through Marionette.
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './marionette.mjs';

// The repository root: the docker compose file of the test webserver lives there.
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const URL = 'http://localhost/';
const ROSCOFF = 'atlasdyn-surf-telemac2d-r1124100-roscoff-563-250m-30min';
const VIEWER = `document.querySelector('[x-data]')._x_dataStack[0]`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  —  ${detail}` : ''}`);
};

let lastError = null;
async function ev(client, snippet) {
  const script = `return (${snippet});`;
  try {
    const result = await client.command('WebDriver:ExecuteScript', { script });
    return result.value;
  } catch (error) {
    throw new Error(`${error.message}\n--- script head: ${script.slice(0, 300)}`);
  }
}
async function waitEv(client, body, tries = 40, delayMs = 250) {
  for (let i = 0; i < tries; i++) {
    try {
      const value = await ev(client, body);
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw lastError ?? new Error('timed out waiting for the page');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A real DOM click on the node an XPath picks; the page's own handlers run.
const clickX = (client, xpath) =>
  ev(client, `(() => {
    const node = document.evaluate(${JSON.stringify(xpath)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (!node) throw new Error('not found: ' + ${JSON.stringify(xpath)});
    node.click();
    return true;
  })()`);
const pad = (n) => String(n).padStart(2, '0');
const pickerAt = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// The map renders with preferCanvas, so the arrows live on a canvas, not in SVG.
// Signature: how many pixels are drawn and a cheap content hash of them.
const arrowSignature = () => {
  const canvas = document.querySelector('.leaflet-overlay-pane canvas');
  if (!canvas) return null;
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let nonEmpty = 0;
  let sum = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) {
      nonEmpty++;
      sum = (sum + data[i - 1] * 3 + data[i - 2] * 5 + data[i - 3] * 7) % 1e9;
    }
  }
  return { nonEmpty, sum };
};

async function main() {
  const client = await connect(2828);
  await client.command('WebDriver:SetWindowRect', { x: 0, y: 0, width: 1280, height: 900 });

  // --- online: first visit installs the service worker
  await client.command('WebDriver:Navigate', { url: URL });
  const swInfo = await waitEv(client, `navigator.serviceWorker.controller !== null ? {
    controlled: true, saveData: navigator.connection?.saveData ?? null
  } : null`, 60, 500);
  check('service worker installs and controls the page', true,
    `saveData in this browser = ${JSON.stringify(swInfo.saveData)}`);

  // Reload into the fully controlled page.
  await client.command('WebDriver:Navigate', { url: URL });
  await waitEv(client, `(() => { const v = ${VIEWER}; return v && v.atlases.length === 15; })()`, 40, 500);
  check('app boots with the 15-atlas index', true);

  // --- download Roscoff through the real buttons
  await clickX(client, "//header//button[normalize-space()='About']");
  await waitEv(client, `(() => { const v = ${VIEWER}; return v.offlineRows.length === 15 && !v.offlineBusy; })()`, 40, 500);
  check('About dialog lists 15 offline rows (metas cached through NetworkFirst)', true);

  // A previous run may have left Roscoff downloaded: clear it through the
  // real button, which also exercises the Remove path.
  if (await ev(client, `(() => { const v = ${VIEWER};
    const row = v.offlineRows.find(r => r.label.includes('Roscoff'));
    return row.buttons.some(b => b.id === 'remove');
  })()`)) {
    await clickX(client, "//li[p[contains(., 'Roscoff')]]//button[normalize-space()='Remove']");
    await waitEv(client, `(() => { const v = ${VIEWER};
      const row = v.offlineRows.find(r => r.label.includes('Roscoff'));
      return row.stateKey === 'about.offline.stateNone' && row.buttons[0].id === 'download';
    })()`, 20, 500);
    const framesLeft = await ev(client, `(async () => (await (await caches.open('atlas-frames')).keys()).length)()`);
    check('Remove deletes the atlas frames from the cache', true, `entries left: ${framesLeft}`);
  }

  await clickX(client, "//li[p[contains(., 'Roscoff')]]//button[normalize-space()='Download']");
  await waitEv(client, `(() => { const v = ${VIEWER};
    const row = v.offlineRows.find(r => r.label.includes('Roscoff'));
    return row && row.buttons[0].key === 'about.offline.confirm';
  })()`, 20, 250);
  const confirmRow = await ev(client, `(() => { const v = ${VIEWER};
    const row = v.offlineRows.find(r => r.label.includes('Roscoff'));
    return { key: row.buttons[0].key, params: row.buttons[0].params, size: row.size };
  })()`);
  check('first tap arms the plain size confirmation (no metered wording)', confirmRow.key === 'about.offline.confirm',
    JSON.stringify(confirmRow));

  await clickX(client, "//li[p[contains(., 'Roscoff')]]//button[contains(., '1.6 MB')]");
  const cancelAppeared = await waitEv(client, `(() => { const v = ${VIEWER};
    const row = v.offlineRows.find(r => r.label.includes('Roscoff'));
    return row && row.buttons.length === 1 && row.buttons[0].id === 'cancel';
  })()`, 20, 250);
  check('Cancel appears right after the confirming tap, without another click', cancelAppeared === true);

  const doneRow = await waitEv(client, `(() => { const v = ${VIEWER};
    const row = v.offlineRows.find(r => r.label.includes('Roscoff'));
    return row.stateKey === 'about.offline.stateComplete'
      && row.stateParams.done === row.stateParams.total
      && row.buttons.length === 1 && row.buttons[0].id === 'remove'
      ? { done: row.stateParams.done, total: row.stateParams.total, warning: row.warning } : null;
  })()`, 80, 500);
  check('download completes: row says Downloaded with a Remove button', true, JSON.stringify(doneRow));

  // --- cache audit: which cache holds what, expected vs present vs missing
  const audit = await ev(client, `(async () => {
    const counts = {};
    for (const name of await caches.keys()) {
      counts[name] = (await (await caches.open(name)).keys()).length;
    }
    const index = await (await fetch('/atlas/index.json')).json();
    const entry = index.atlases.find(a => a.id === '${ROSCOFF}');
    const meta = await (await fetch('/atlas/' + entry.id + '/meta.json?v=' + entry.version)).json();
    const urls = [];
    for (let c = 0; c < meta.coeffs.length; c++) {
      for (let t = 0; t < meta.nt; t++) {
        urls.push('/atlas/' + meta.id + '/f_c' + c + '_t' + t + '.bin?v=' + (meta.version ?? meta.release));
      }
    }
    const cache = await caches.open('atlas-frames');
    let present = 0;
    for (const url of urls) if (await cache.match(url)) present++;
    return { counts, expected: urls.length, present, missing: urls.length - present };
  })()`);
  check('frame cache holds exactly the 50 expected Roscoff frames',
    audit.expected === 50 && audit.present === 50 && audit.missing === 0,
    JSON.stringify(audit));

  // --- truly offline: stop the webserver, reload, manual tide, step frames
  execSync('docker compose stop php', { cwd: PROJECT });
  await sleep(1500);
  await client.command('WebDriver:Navigate', { url: URL });
  await waitEv(client, `(() => { const v = ${VIEWER}; return v && v.atlases.length === 15; })()`, 40, 500);
  check('offline reload boots from the service worker (index from NetworkFirst fallback)', true);

  await ev(client, `(async () => { ${VIEWER}.selectAtlas('${ROSCOFF}'); })()`);
  await waitEv(client, `(() => { const v = ${VIEWER}; return v.hasData; })()`, 40, 500);
  check('Roscoff opens offline (meta.json from the index cache)', true);

  await ev(client, `(async () => {
    const v = ${VIEWER};
    v.manualHw = '${pickerAt(Date.now())}';
    v.manualCoef = '70';
    v.useManualTide();
  })()`);
  await waitEv(client, `(() => { const v = ${VIEWER};
    const canvas = document.querySelector('.leaflet-overlay-pane canvas');
    return canvas && !v.busy && v.error === null ? 'ready' : null;
  })()`, 40, 500);
  const offlineArrows = await ev(client, `(() => { const arrowSignature = ${arrowSignature}; return arrowSignature(); })()`);
  check('offline with a manual tide: arrows appear, no error', offlineArrows && offlineArrows.nonEmpty > 0,
    JSON.stringify(offlineArrows));

  const captures = [];
  let arrowsMove = true;
  for (let step = 0; step < 4; step++) {
    await ev(client, `(async () => { ${VIEWER}.stepTime(30); })()`);
    await waitEv(client, `(() => { const v = ${VIEWER}; return !v.busy; })()`, 20, 500);
    await sleep(400);
    captures.push(await ev(client, `(() => { const arrowSignature = ${arrowSignature}; return arrowSignature(); })()`));
    const noError = await ev(client, `(() => { const v = ${VIEWER}; return v.error === null; })()`);
    if (!noError) arrowsMove = false;
  }
  const distinct = new Set(captures.map((c) => JSON.stringify(c)));
  check('four time steps change the arrows offline, error stays clear',
    arrowsMove && distinct.size === captures.length, `distinct arrow sets: ${distinct.size}/4`);

  const beforePlay = await ev(client, `(() => { const arrowSignature = ${arrowSignature}; return arrowSignature(); })()`);
  await ev(client, `(async () => { ${VIEWER}.togglePlay(); })()`);
  await sleep(2500);
  await ev(client, `(async () => { ${VIEWER}.stop(); })()`);
  const afterPlay = await ev(client, `(() => { const arrowSignature = ${arrowSignature}; return arrowSignature(); })()`);
  check('playback moves the arrows offline', JSON.stringify(beforePlay) !== JSON.stringify(afterPlay));

  // --- stale error: delete two frames offline, step onto them, then recover
  // The manual HW is derived from the live marker, so the draw is exactly at
  // offset -180 (frame 6) and one step lands on frame 7.
  await ev(client, `(async () => {
    const v = ${VIEWER};
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date(v.centerMs + 180 * 60000);
    v.manualHw = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    v.manualCoef = '70';
    v.useManualTide();
    return true;
  })()`);
  const atSix = await waitEv(client, `(() => { const v = ${VIEWER};
    return !v.busy && v.error === null && v.detail.includes('−3:00');
  })()`, 20, 500);
  check('the marker sits at frame 6 (offset −180) with a manual tide', atSix === true);

  // Frame 7 (one step ahead) is not in the in-memory store yet: deleting its
  // cache entries forces a network fetch when the marker steps onto it.
  const deletedInfo = await ev(client, `(async () => {
    const index = await (await fetch('/atlas/index.json')).json();
    const entry = index.atlases.find(a => a.id === '${ROSCOFF}');
    const meta = await (await fetch('/atlas/' + entry.id + '/meta.json?v=' + entry.version)).json();
    const cache = await caches.open('atlas-frames');
    const version = meta.version ?? meta.release;
    let removed = 0;
    for (const c of [0, 1]) {
      const url = '/atlas/' + meta.id + '/f_c' + c + '_t7.bin?v=' + version;
      if (await cache.delete(url)) removed++;
    }
    return { removed };
  })()`);
  check('two of the next frame pair are removed from the cache', deletedInfo.removed === 2,
    JSON.stringify(deletedInfo));

  await ev(client, `(async () => { ${VIEWER}.stepTime(30); })()`);
  const errorShown = await waitEv(client, `(() => { const v = ${VIEWER};
    return !v.busy && v.error !== null ? v.errorText : null;
  })()`, 20, 500);
  check('stepping onto a missing frame shows the frame error offline', true, `"${errorShown}"`);

  execSync('docker compose start php', { cwd: PROJECT });
  await sleep(4000);
  // One more step: frame 8 is not in the in-memory store either, so it must be
  // fetched — now from the network — and its arrival clears the stale error.
  await ev(client, `(async () => { ${VIEWER}.stepTime(30); })()`);
  const recovered = await waitEv(client, `(() => { const v = ${VIEWER};
    return v.error === null && !v.busy ? { text: v.errorText } : null;
  })()`, 20, 500);
  check('back online, the next frame loads and the stale error is cleared by recovery', true,
    JSON.stringify(recovered));

  // --- responsive dialog at 320 and 375 px
  for (const width of [320, 375]) {
    await client.command('WebDriver:SetWindowRect', { x: 0, y: 0, width, height: 800 });
    await sleep(400);
    await clickX(client, "//header//button[normalize-space()='About']");
    await waitEv(client, `(() => { const v = ${VIEWER}; return v.offlineRows.length === 15; })()`, 20, 250);
    const metrics = await ev(client, `(() => {
      const dialog = document.querySelector('dialog[open]') || document.querySelector('dialog');
      const rows = Array.from(document.querySelectorAll('dialog li'));
      return {
        pageScrolls: document.documentElement.scrollWidth - window.innerWidth,
        dialogScrolls: dialog.scrollWidth - dialog.clientWidth,
        rowsScrolling: rows.filter(li => li.scrollWidth > li.clientWidth + 1).length,
        rowCount: rows.length,
      };
    })()`);
    check(`no horizontal scrolling at ${width}px`, metrics.pageScrolls <= 1 && metrics.dialogScrolls <= 1
      && metrics.rowsScrolling === 0, JSON.stringify(metrics));
    await clickX(client, "//dialog//form[@method='dialog']//button");
  }
  await client.command('WebDriver:SetWindowRect', { x: 0, y: 0, width: 1280, height: 900 });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('ABORTED:', error.message);
  process.exit(2);
});
