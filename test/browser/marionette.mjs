// Minimal Marionette client: raw TCP, packet form [type, id, name/error, body].
// Commands are [0, id, name, params]; responses [1, id, error, body].
// Connects are retried: the headless browser may still be binding its port.
import net from 'node:net';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function connect(port = 2828, tries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      openSocket(port)
        .then(resolve)
        .catch((error) => {
          if (left <= 1) reject(error);
          else setTimeout(() => attempt(left - 1), 500);
        });
    };
    attempt(tries);
  });
}

function openSocket(port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('error', reject);

    let buffer = Buffer.alloc(0);
    let sessionId = null;
    let nextId = 0;
    const pending = new Map();

    const takePacket = () => {
      // Every message, including the hello, is "len:json".
      const colon = buffer.indexOf(0x3a /* : */);
      if (colon === -1) return;
      const length = Number(buffer.toString('utf8', 0, colon));
      if (!Number.isFinite(length) || buffer.length < colon + 1 + length) return;

      const body = buffer.toString('utf8', colon + 1, colon + 1 + length);
      buffer = buffer.subarray(colon + 1 + length);

      const message = JSON.parse(body);
      const waiter = pending.get(message[1]);
      pending.delete(message[1]);
      if (!waiter) return; // the hello has no id

      if (message[2]) waiter.reject(new Error(`${message[2].error || 'error'}: ${message[2].message}`));
      else waiter.resolve(message[3]);
    };

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const before = buffer.length;
        takePacket();
        if (buffer.length === before) break;
      }
    });

    const command = (name, parameters = {}) =>
      new Promise((res, rej) => {
        const id = ++nextId;
        pending.set(id, { resolve: res, reject: rej });
        const payload = JSON.stringify([0, id, name, parameters]);
        socket.write(`${Buffer.byteLength(payload)}:${payload}`);
      });

    socket.once('connect', async () => {
      try {
        const body = await command('WebDriver:NewSession', { capabilities: {} });
        sessionId = body.sessionId ?? body.value?.sessionId;
        if (!sessionId) throw new Error(`No session id in ${JSON.stringify(body).slice(0, 200)}`);
        resolve({ command, sessionId });
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Runs a snippet in the page; reports { ok, value } or { ok: false, error }.
export const pageScript = (body) => `
  const done = arguments[arguments.length - 1];
  (async () => {
    try {
      done({ ok: true, value: await (${body})() });
    } catch (error) {
      done({ ok: false, error: String((error && error.message) || error) });
    }
  })();
`;
