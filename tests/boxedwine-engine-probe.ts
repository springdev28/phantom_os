/** Opt-in developer probe. Uses downloaded, hash-checked engine files only.
 * Never serves boxedwine.zip, the upstream web shell or its demo game.
 * This is engine-bootstrap/mount/failure evidence, NOT Windows execution acceptance.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import ts from 'typescript';

const directory = process.argv[2];
assert(directory, 'Usage: npm run test:boxedwine -- /absolute/path/to/audited-engine');
const manifest = JSON.parse(await readFile('tests/fixtures/boxedwine-artifacts.json', 'utf8')) as {
  release: string; sourceCommit: string; engine: { name: string; bytes: number; sha256: string }[];
};
const engines = new Map<string, Buffer>();
for (const asset of manifest.engine) {
  const bytes: Buffer = await readFile(join(resolve(directory), asset.name));
  assert.equal(bytes.length, asset.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  engines.set(asset.name, bytes);
}
const bridgeSource = await readFile('src/runtime/boxedwine/bridge.ts', 'utf8');
const bridge = ts.transpileModule(bridgeSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace('export function createBoxedwineMemoryMount', 'function createBoxedwineMemoryMount');
const wasmBase64 = engines.get('boxedwine.wasm')!.toString('base64');
const host = `<!doctype html><html><head><meta charset="utf-8"></head><body><canvas id="canvas" width="800" height="600"></canvas>
<script>${bridge}
var report = { messages: [], stage: 'loading', windowsProgramLaunched: false, networkAttempts: [], storageAttempts: 0 };
function send() { parent.postMessage({ kind: 'boxedwine-probe', report }, '*'); }
// Deny all runtime network/storage access, including attempts before the guest exists.
for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'RTCPeerConnection']) {
  Object.defineProperty(globalThis, key, { configurable: false, value: function() { report.networkAttempts.push(key); send(); throw new Error('NETWORK_DISABLED'); } });
}
for (const key of ['indexedDB', 'localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, key, { configurable: false, get() { report.storageAttempts++; send(); throw new Error('STORAGE_DISABLED'); } });
}
var Module = {
  wasmBinary: Uint8Array.from(atob(${JSON.stringify(wasmBase64)}), character => character.charCodeAt(0)),
  canvas: document.getElementById('canvas'),
  arguments: ['-root', '/root', '-mount_drive', '/d_drive', 'd', '-nosound', '/bin/wine', 'notepad'],
  preRun: [function() {
    const mount = createBoxedwineMemoryMount(FS);
    mount.directory('EMPTY'); mount.write('SUPPORT/INPUT.TXT', new TextEncoder().encode('PHANTOM engine probe only\\r\\n'));
    report.stagedText = new TextDecoder().decode(FS.readFile('/d_drive/SUPPORT/INPUT.TXT'));
    report.emptyDirectory = FS.isDir(FS.stat('/d_drive/EMPTY').mode);
    report.rootIsMemfs = FS.root.mount.type === MEMFS;
    report.additionalMounts = FS.mounts.length;
    report.stage = 'staged'; send();
  }],
  onRuntimeInitialized: function() { report.initialized = true; report.wasmMemoryBytes = wasmMemory.buffer.byteLength; send(); },
  print: function(text) { report.messages.push(String(text)); send(); },
  printErr: function(text) { report.messages.push(String(text)); send(); },
  postRun: [function() { report.stage = 'main-returned'; send(); }],
  onAbort: function(reason) { report.stage = 'aborted'; report.abort = String(reason); send(); }
};
</script><script src="/engine.js"></script></body></html>`;
const pageHtml = '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><p>Engine-only Boxedwine probe. No Windows filesystem or application is loaded.</p></body></html>';
const routes = new Map([
  ['/', { body: Buffer.from(pageHtml), mime: 'text/html' }],
  ['/engine-host', { body: Buffer.from(host), mime: 'text/html' }],
  ['/engine.js', { body: engines.get('boxedwine.js')!, mime: 'text/javascript' }],
]);
const requests: string[] = [];
const server = createServer((request, response) => {
  requests.push(`${request.method} ${request.url}`);
  const route = request.method === 'GET' ? routes.get(request.url ?? '') : undefined;
  if (!route) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': route.mime,
    'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'none'; img-src data:; frame-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'" });
  response.end(route.body);
});
await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
const address = server.address(); assert(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const context = await browser.newContext();
const page = await context.newPage();
const traffic: string[] = [], errors: string[] = [], sockets: string[] = [];
context.on('request', request => traffic.push(`${request.method()} ${request.url().replace(origin, '[loopback]')}`));
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('websocket', socket => sockets.push(socket.url()));
const cycles = [];
try {
  await page.goto(origin);
  for (let cycle = 1; cycle <= 3; cycle++) {
    const start = performance.now();
    await page.evaluate(() => {
      (window as unknown as { probe: unknown }).probe = null;
      const frame = document.createElement('iframe'); frame.sandbox.add('allow-scripts'); frame.src = '/engine-host';
      window.onmessage = event => {
        if (event.source === frame.contentWindow && event.data?.kind === 'boxedwine-probe') (window as unknown as { probe: unknown }).probe = event.data.report;
      };
      document.body.append(frame);
    });
    await expect.poll(() => page.evaluate(() => (window as unknown as { probe?: { stage: string } }).probe?.stage), { timeout: 20_000 }).toMatch(/main-returned|aborted/);
    const report = await page.evaluate(() => (window as unknown as { probe: Record<string, unknown> }).probe);
    assert.equal(report.initialized, true); assert.equal(report.stagedText, 'PHANTOM engine probe only\r\n');
    assert.equal(report.emptyDirectory, true); assert.equal(report.windowsProgramLaunched, false);
    assert.equal(report.rootIsMemfs, true); assert.equal(report.additionalMounts, 0);
    assert.deepEqual(report.networkAttempts, []); assert.equal(report.storageAttempts, 0);
    assert.equal(report.stage, 'main-returned');
    assert((report.messages as string[]).includes('Could not find /bin/wine'));
    assert((report.messages as string[]).includes('Boxedwine shutdown'));
    const elapsedMs = Math.round(performance.now() - start), stop = performance.now();
    await page.evaluate(() => { document.querySelector('iframe')?.remove(); window.onmessage = null; });
    await expect(page.locator('iframe')).toHaveCount(0); assert.equal(page.frames().length, 1); assert.equal(page.workers().length, 0);
    cycles.push({ cycle, elapsedMs, frameRemovalMs: Math.round(performance.now() - stop), report });
  }
  assert.deepEqual(errors, []); assert.deepEqual(sockets, []);
  assert(requests.every(request => ['GET /', 'GET /engine-host', 'GET /engine.js'].includes(request)));
  assert(traffic.every(request => request.startsWith('GET [loopback]/')));
  const result = { scope: 'engine-only bootstrap and missing-environment failure; NOT Windows application execution',
    browser: browser.version(), platform: process.platform, architecture: process.arch, release: manifest.release,
    sourceCommit: manifest.sourceCommit, assets: manifest.engine, bridgeSha256: createHash('sha256').update(bridgeSource).digest('hex'),
    filesystemLoaded: false, windowsProgramLaunched: false, windowsInputTested: false, windowsCleanStopTested: false,
    cycles, traffic, requests, errors, sockets, remainingWorkers: page.workers().length, serviceWorkers: context.serviceWorkers().length };
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/boxedwine-engine-probe.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ result: 'engine-only probe passed; Windows unverified', browser: result.browser, cycles: cycles.length, log: 'test-results/boxedwine-engine-probe.json' }));
} finally { await browser.close(); await new Promise<void>(done => server.close(() => done())); }
