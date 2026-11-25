// Browser acceptance for the offline-unavailability cases:
//   1. atlas metadata absent, frames absent (Calais, never opened),
//   2. metadata cached through Menu → Downloads, frames absent (Dunkerque,
//      never opened — so no frame of it can be cached),
//   3. partially cached atlas, requested frames missing,
//   4. no explicit download, but requested frames cached through browsing,
// plus reconnection and successful recovery. Every message is checked for
// real visibility in the DOM, not only in component state.
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './marionette.mjs';

// The repository root: the docker compose file of the test webserver lives there.
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const URL = 'http://localhost/';
const CALAIS = 'atlasdyn-surf-telemac3d-surf-r1121200-calais-557-250m-5min';
const DUNKERQUE = 'atlasdyn-surf-telemac3d-surf-r1121100-dunkerque-557-250m-5min';
const VIEWER = `document.querySelector('[x-data]')._x_dataStack[0]`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  —  ${detail}` : ''}`);
};

let lastError = null;
async function ev(client, snippet) {
  const result = await client.command('WebDriver:ExecuteScript', {
    script: `return (${snippet});`,
  });
  return result.value;
}
async function waitEv(client, snippet, tries = 40, delayMs = 500) {
  for (let i = 0; i < tries; i++) {
    try {
      const value = await ev(client, snippet);
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw lastError ?? new Error('timed out waiting for the page');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// What the page really shows: the header error box and the map badges.
// The badges are the warning chips of the stacked container above the map's
// attribution (quality, stale data, missing tide).
const DOM = `(() => {
  const errorBox = document.querySelector('header div[x-show="error"]');
  const errorVisible = errorBox && errorBox.offsetParent !== null;
  const badges = Array.from(document.querySelectorAll('main .absolute.inset-x-3 > div'))
    .filter((el) => el.offsetParent !== null)
    .map((el) => el.textContent.trim());
  return { errorVisible, errorText: errorVisible ? errorBox.textContent.trim() : '', badges };
})()`;

const MANUAL_TIDE = `(async () => {
  const v = ${VIEWER};
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date(v.centerMs || Date.now());
  v.manualHw = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  v.manualCoef = '70';
  v.useManualTide();
  return true;
})()`;

async function main() {
  const client = await connect(2828);
  await client.command('WebDriver:SetWindowRect', { x: 0, y: 0, width: 1280, height: 900 });

  // --- online first visit: service worker installs and caches the app
  await client.command('WebDriver:Navigate', { url: URL });
  await waitEv(client, `navigator.serviceWorker.controller !== null`, 60, 500);
  await client.command('WebDriver:Navigate', { url: URL });
  await waitEv(client, `(() => { const v = ${VIEWER}; return v && v.atlases.length === 15; })()`, 40, 500);
  const boot = await ev(client, DOM);
  check('online boot: app and index load, nothing offline-related shown',
    !boot.errorVisible && boot.badges.length === 0, JSON.stringify(boot));

  // --- case 1: never opened, never downloaded, webserver off
  execSync('docker compose stop php', { cwd: PROJECT });
  await sleep(1500);
  await ev(client, `(async () => { ${VIEWER}.selectAtlas('${CALAIS}'); })()`);
  await sleep(2500);
  const case1 = await ev(client, `(() => { const dom = ${DOM};
    return { ...dom, hasData: ${VIEWER}.hasData };
  })()`);
  check('case 1 (meta absent, frames absent): the offline atlas message is visible',
    case1.errorVisible && /not available offline/.test(case1.errorText)
      && case1.errorText.includes('Menu → Downloads'),
    JSON.stringify(case1).slice(0, 220));
  check('case 1: the atlas does not open, so no arrows of it can be shown',
    case1.hasData === false, `hasData: ${case1.hasData}`);
  check('case 1: the tide badge does not show without an open atlas',
    !case1.badges.some((text) => text.includes('arrows need the tide')), JSON.stringify(case1.badges));

  // The error strip points to Menu → Downloads with an action that opens the
  // section directly.
  await ev(client, `(async () => {
    const btn = Array.from(document.querySelectorAll('header button'))
      .find((b) => b.offsetParent !== null && b.textContent.trim() === 'Downloads');
    if (!btn) throw new Error('no Downloads action in the error strip');
    btn.click();
    return true;
  })()`);
  const sheetOpen = await waitEv(client, `(() => { const menu = document.getElementById('menu');
    const tab = document.getElementById('menu-tab-downloads');
    return menu.open && tab.getAttribute('aria-selected') === 'true'
      && document.getElementById('menu-panel-downloads') ? true : null; })()`, 10, 250);
  check('case 1: the error strip offers a Downloads action that opens the Downloads tab',
    sheetOpen === true);

  // Blocked meta.json (webserver off, metas never cached): every frame atlas
  // keeps a row with its label, "Size unavailable" and a Retry button — the
  // panel is never silently empty. The probe throws on zero matches, so a
  // missing panel or list fails with a cause instead of a bare timeout.
  const failedRows = await waitEv(client, `(async () => {
    const v = ${VIEWER};
    if (!v || v.offlineBusy || v.offlineRows.length !== v.atlases.length) return null;
    const panel = document.getElementById('menu-panel-downloads');
    if (!panel) throw new Error('no #menu-panel-downloads in the DOM');
    const rows = Array.from(panel.querySelectorAll('ul > li'));
    if (!rows.length) throw new Error('no rendered rows in the Downloads panel');
    const retryOf = (li) => Array.from(li.querySelectorAll('button')).filter((b) => b.textContent.trim() === 'Retry');
    const missingRetry = rows.filter((li) => retryOf(li).length !== 1);
    if (missingRetry.length) throw new Error(missingRetry.length + ' row(s) without exactly one Retry button');
    const withoutSize = rows.filter((li) => !li.textContent.includes('Size unavailable'));
    if (withoutSize.length) throw new Error(withoutSize.length + ' row(s) without the size-unavailable text');
    return { rows: rows.length, failedState: v.offlineRows.every((r) => r.metaFailed) };
  })()`, 20, 500);
  check('case 1: blocked metas keep every atlas in the list with Retry and an unavailable size',
    failedRows?.rows === 15 && failedRows?.failedState === true,
    JSON.stringify(failedRows));

  await ev(client, `(() => { document.getElementById('menu').close(); return true; })()`);

  // --- reconnection: the same tap opens the atlas online; the Menu sheet's
  // Downloads section caches every meta.json, which prepares case 2 without
  // opening its atlas.
  execSync('docker compose start php', { cwd: PROJECT });
  await sleep(4500);
  await ev(client, `(async () => { ${VIEWER}.selectAtlas('${CALAIS}'); })()`);
  await waitEv(client, `(() => { const v = ${VIEWER}; return v.hasData && !v.busy; })()`, 40, 500);
  await ev(client, MANUAL_TIDE);
  await waitEv(client, `(() => { const v = ${VIEWER}; return !v.busy && v.error === null; })()`, 40, 500);
  const onlineOpen = await ev(client, DOM);
  check('reconnected: the atlas opens, the error box is clear', !onlineOpen.errorVisible,
    JSON.stringify(onlineOpen.badges));
  await ev(client, `(async () => {
    const node = document.evaluate("//header//button[@aria-haspopup='dialog']", document, null,
      XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    node.click();
  })()`);
  await waitEv(client, `document.getElementById('menu').open`, 20, 250);
  await ev(client, `(async () => {
    const node = document.evaluate("//dialog[@id='menu']//button[@role='tab'][normalize-space()='Downloads']", document, null,
      XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    node.click();
  })()`);
  const warmedRows = await waitEv(client, `(() => { const v = ${VIEWER};
    return v.offlineRows.length === 15 && !v.offlineBusy ? v.offlineRows.length : null; })()`, 40, 500);
  await ev(client, `(async () => {
    const node = document.evaluate("//dialog[@id='menu']//form[@method='dialog']//button", document, null,
      XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    node.click();
  })()`);
  check('Menu sheet opened and closed online: every meta.json is cached', warmedRows === 15,
    `rows: ${warmedRows}`);

  // --- insecure-context case: on a plain http address off localhost the
  // Cache API (and the worker) do not exist, and the download used to fail
  // with only a console warning. Served over the host's LAN IP the panel must
  // say why and offer no dead buttons.
  await ev(client, `(() => { document.getElementById('menu').close(); return true; })()`);
  const HOST_IP = execSync('hostname -I', { encoding: 'utf8' }).trim().split(/\s+/)[0];
  await client.command('WebDriver:Navigate', { url: `http://${HOST_IP}/` });
  await waitEv(client, `(() => { try { const v = ${VIEWER}; return v && v.atlases.length > 0; } catch { return null; } })()`, 40, 500);
  await ev(client, `(async () => {
    const node = document.evaluate("//header//button[@aria-haspopup='dialog']", document, null,
      XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    node.click();
  })()`);
  await waitEv(client, `document.getElementById('menu').open`, 20, 250);
  await ev(client, `(() => { document.getElementById('menu-tab-downloads').click(); return true; })()`);
  const noStorage = await waitEv(client, `(async () => {
    const v = ${VIEWER};
    if (v.offlineBusy || v.offlineRows.length !== 15) return null;
    const panel = document.getElementById('menu-panel-downloads');
    if (!panel) throw new Error('no #menu-panel-downloads in the DOM');
    const message = Array.from(panel.querySelectorAll('p'))
      .find((p) => p.getClientRects().length > 0 && p.textContent.includes('secure addresses'));
    if (!message) throw new Error('no visible no-storage message in the Downloads panel');
    const rows = Array.from(panel.querySelectorAll('ul > li'));
    if (!rows.length) throw new Error('no rendered rows in the Downloads panel');
    const deadButtons = rows.filter((li) => Array.from(li.querySelectorAll('button')).some((b) => /Download|Cancel/.test(b.textContent)));
    if (deadButtons.length) throw new Error(deadButtons.length + ' row(s) still offer Download or Cancel without storage');
    return { rows: rows.length, blocked: v.downloadsBlocked, secure: window.isSecureContext };
  })()`, 20, 500);
  check('insecure address (no Cache API): the panel explains it and offers no dead buttons',
    noStorage?.rows === 15 && noStorage?.blocked === true && noStorage?.secure === false,
    JSON.stringify(noStorage));

  await client.command('WebDriver:Navigate', { url: URL });
  await waitEv(client, `(() => { try { const v = ${VIEWER}; return v && v.atlases.length > 0; } catch { return null; } })()`, 40, 500);

  // --- case 2: meta cached through the About dialog, frames absent
  execSync('docker compose stop php', { cwd: PROJECT });
  await sleep(1500);
  await client.command('WebDriver:Navigate', { url: URL });
  await waitEv(client, `(() => { const v = ${VIEWER}; return v && v.atlases.length === 15; })()`, 40, 500);
  await ev(client, `(async () => { ${VIEWER}.selectAtlas('${DUNKERQUE}'); })()`);
  await waitEv(client, `(() => { const v = ${VIEWER}; return v.hasData && !v.busy; })()`, 40, 500);
  const noTide = await waitEv(client, `(() => { const dom = ${DOM};
    return dom.badges.some((t) => t.includes('The arrows need the tide')) ? dom.badges : null;
  })()`, 20, 500);
  check('case 2: the map says the tide is needed before arrows can be requested',
    noTide !== null, JSON.stringify(noTide));

  await ev(client, MANUAL_TIDE);
  const case2 = await waitEv(client, `(() => { const dom = ${DOM};
    return dom.errorVisible && /not available offline/.test(dom.errorText) ? dom : null;
  })()`, 20, 500);
  check('case 2 (meta cached, frames absent): the offline frames message is visible',
    case2 !== null && !case2.errorText.includes('Only part'),
    JSON.stringify(case2).slice(0, 220));
  check('case 2: nothing was ever drawn, so no stale badge and no tide badge remain',
    !case2.badges.some((t) => t.includes('Current data unavailable'))
      && !case2.badges.some((t) => t.includes('arrows need the tide')),
    JSON.stringify(case2.badges));

  // --- case 3/4 setup: reconnect and browse one step, which caches that moment
  execSync('docker compose start php', { cwd: PROJECT });
  await sleep(4500);
  await ev(client, `(async () => { ${VIEWER}.stepTime(60); })()`);
  const browsed = await waitEv(client, `(() => { const v = ${VIEWER};
    return !v.busy && v.error === null;
  })()`, 40, 500);
  check('reconnected: the next moment loads online and clears the offline message',
    browsed === true);

  // --- case 3: webserver off, step onto a moment that was never cached
  execSync('docker compose stop php', { cwd: PROJECT });
  await sleep(1500);
  await ev(client, `(async () => { ${VIEWER}.stepTime(60); })()`);
  const case3 = await waitEv(client, `(() => { const dom = ${DOM};
    return dom.errorVisible && dom.errorText.includes('Only part of this atlas is downloaded')
      ? dom : null;
  })()`, 20, 500);
  check('case 3 (partial cache): the message explains the partial download',
    case3 !== null, JSON.stringify(case3).slice(0, 200));
  const staleState = await ev(client, DOM);
  check('case 3: the stale badge marks the old arrows on the map',
    staleState.badges.some((text) => text.includes('Current data unavailable')),
    JSON.stringify(staleState.badges));

  // --- case 4 + recovery: step back onto the browsed, cached moment offline.
  // Its frames are in memory, so the draw is instant and no gate event fires:
  // the render path itself must clear the offline message.
  await ev(client, `(async () => { ${VIEWER}.stepTime(-60); })()`);
  const case4 = await waitEv(client, `(() => { const dom = ${DOM};
    const v = ${VIEWER};
    return !dom.errorVisible && v.drawStale === false
      && !dom.badges.some((t) => t.includes('Current data unavailable')) ? dom : null;
  })()`, 20, 500);
  check('case 4: cached frames of a never-downloaded atlas draw offline, message cleared',
    case4 !== null, JSON.stringify(case4).slice(0, 160));

  // --- reconnection after a failure: the missing moment loads and clears the error
  await ev(client, `(async () => { ${VIEWER}.stepTime(60); })()`);
  await waitEv(client, `(() => { const v = ${VIEWER}; return !v.busy && v.error !== null; })()`, 20, 500);
  execSync('docker compose start php', { cwd: PROJECT });
  await sleep(4500);
  await ev(client, `(async () => { ${VIEWER}.stepTime(30); })()`);
  const recovered = await waitEv(client, `(() => { const v = ${VIEWER};
    return !v.busy && v.error === null;
  })()`, 20, 500);
  check('reconnected after failure: the missing moment loads and the message clears', recovered === true);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('ABORTED:', error.message);
  process.exit(2);
});
