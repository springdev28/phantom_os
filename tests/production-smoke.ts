import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, devices, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { mixedPackageFiles, packageZip } from './fixtures/package-fixtures.ts';
import { selectFixture, start, command, downloadGuest } from './fixtures/dos-browser.ts';
import { peFixture, neFixture } from './fixtures/probe-fixtures.ts';
import { preview } from 'vite';
import { securityAcceptance } from './fixtures/security-browser.ts';

// Exercise the ordinary npm run preview hosting policy, not a test-only CSP.
const root = join(process.cwd(), 'dist');
const assets = new Map<string, Buffer>();
for (const name of await readdir(root, { recursive: true })) {
  if ((await stat(join(root, name))).isFile()) assets.set(`/${name.replaceAll('\\', '/')}`, await readFile(join(root, name)));
}
const previewServer = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const server = previewServer.httpServer;
const address = server.address(); assert(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
let browser: Browser | undefined;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  const runs = [];
  for (const [name, options] of [['desktop', { viewport: { width: 1440, height: 1100 } }], ['mobile', devices['Pixel 7']!]] as const) {
    const context = await browser.newContext(options), page = await context.newPage();
    const errors: string[] = [], traffic: string[] = [], workers: string[] = [];
    context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('worker', worker => workers.push(worker.url()));
    await page.goto(`${origin}/#/inspect`);
    await page.getByRole('heading', { name: 'No file selected' }).waitFor();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Compatibility', exact: true }).click();
    await page.getByRole('link', { name: 'Review or import launch settings' }).click();
    await page.getByRole('heading', { name: 'Launch profile', exact: true }).waitFor();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inspect', exact: true }).click();
    await page.waitForLoadState('networkidle');
    const loadedRequests = traffic.length;
    for (const offline of [false, true]) {
      await context.setOffline(offline);
      await page.getByLabel('Choose a ZIP archive').setInputFiles({ name: 'PRIVATE_PRODUCTION_PACKAGE.zip', mimeType: 'application/zip', buffer: Buffer.from(packageZip(mixedPackageFiles)) });
      await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
      await expect(page.getByRole('radio')).toHaveCount(2);
      await expect(page.getByTestId('entrypoint-status')).toHaveText('No entrypoint selected');
      await page.getByRole('radio', { name: 'Choose APP/MAIN.EXE as entrypoint', exact: true }).check();
      await expect(page.getByTestId('entrypoint-status')).toContainText('APP/MAIN.EXE');
      await expect(page.getByRole('list', { name: 'Package files' }).getByRole('listitem')).toHaveCount(8);
      await expect.poll(() => page.workers().length).toBe(0);
      await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
      await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
      await expect(page.getByRole('link', { name: 'Configure launch' })).toBeVisible();
      await page.getByRole('link', { name: 'Review or import launch settings' }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export profile JSON' }).click();
      const json = await readFile((await (await download).path())!, 'utf8');
      const profile = JSON.parse(json);
      assert(profile.runtimeId === 'js-dos' && profile.runtimeVersion === '8.5.3' && /^emulators-8.5.3-e6f4e544-dosbox-[a-f0-9]{12}$/.test(profile.runtimeBuildId));
      assert(profile.entrypoint === 'APP/MAIN.EXE' && profile.requiredFiles.length === 8);
      assert(!json.includes('INSPECTION_MUST_NOT_EXECUTE_THIS_SCRIPT'));
      await page.getByLabel('Choose a launch profile JSON').setInputFiles({ name: 'PRIVATE_PRODUCTION_PROFILE.json', mimeType: 'application/json', buffer: Buffer.from(json) });
      await expect(page.getByText('Profile imported.', { exact: false })).toBeVisible();
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Compatibility', exact: true }).click();
      await expect(page.getByTestId('compatibility-decision')).toHaveText('experimental');
      await page.getByRole('link', { name: 'Review or import launch settings' }).click();
      await page.getByRole('button', { name: 'Reset profile' }).click();
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inspect', exact: true }).click();
    }
    const faviconRequests = traffic.slice(loadedRequests).filter(line => line === `GET ${origin}/favicon.svg `).length;
    assert(traffic.slice(loadedRequests).every(line => line.startsWith(`GET blob:${origin}/`) || line === `GET ${origin}/favicon.svg `),
      `Only local Blob loads and fixed app favicon revalidation are allowed after views load; observed: ${JSON.stringify(traffic.slice(loadedRequests))}`);
    assert(traffic.every(line => line.startsWith(`GET ${origin}/`) || line.startsWith(`GET blob:${origin}/`)));
    assert(!traffic.join('\n').includes('PRIVATE_PRODUCTION_PACKAGE'));
    assert(!traffic.join('\n').includes('PRIVATE_PRODUCTION_PROFILE'));
    assert(workers.length === 2 && workers.every(url => url.startsWith(`blob:${origin}/`)));
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length,
      databases: (await indexedDB.databases()).length, caches: (await caches.keys()).length })),
    { local: 0, session: 0, databases: 0, caches: 0 });
    runs.push({ viewport: name, online: 'passed', offlineAfterViewsLoad: 'passed', userDataRequests: 0, unexpectedRequests: 0, staticFaviconRequestsAfterLoad: faviconRequests, localBlobWorkerLoads: workers.length, consoleErrors: 0,
      completedWorkers: workers.length, remainingWorkers: page.workers().length, filesRetained: 8, candidates: 2, profileRoundTrips: 2, decision: 'experimental-after-applying-profile', executionOffered: true, executionStarted: false });
    await context.close();
  }
  const windowsRuns = [];
  for (const [name, options] of [['desktop', { viewport: { width: 1440, height: 1100 } }], ['mobile', devices['Pixel 7']!]] as const) {
    const context = await browser.newContext(options), page = await context.newPage();
    const traffic: string[] = [], errors: string[] = [], sockets: string[] = [];
    context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('websocket', socket => sockets.push(socket.url()));
    await page.goto(`${origin}/#/inspect`);
    for (const [format, bytes] of [['PE32', peFixture()], ['NE', neFixture()]] as const) {
      const file = `PRIVATE_WINDOWS_${format}.COM`;
      await page.getByLabel('Choose a local file', { exact: true }).setInputFiles({ name: file, mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
      await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
      await page.getByRole('radio', { name: `Choose ${file} as entrypoint`, exact: true }).check();
      await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
      await expect(page.getByTestId('compatibility-decision')).toHaveText('experimental');
      await expect(page.locator('.planner-issues')).toContainText('Windows execution has not been verified');
      await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
      await page.getByRole('link', { name: 'Review or import launch settings' }).click();
      const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export profile JSON' }).click();
      const profile = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
      assert.equal(profile.runtimeId, 'boxedwine'); assert.equal(profile.runtimeVersion, null);
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Player', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Windows execution unverified', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Windows execution unavailable', exact: true })).toBeDisabled();
      await expect(page.locator('iframe, canvas')).toHaveCount(0);
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inspect', exact: true }).click();
    }
    assert(!traffic.join('\n').match(/PRIVATE_WINDOWS|\/runtimes\//));
    assert(traffic.every(line => line.startsWith(`GET ${origin}/`)));
    assert.deepEqual(errors, []); assert.deepEqual(sockets, []); assert.equal(page.workers().length, 0); assert.equal(context.serviceWorkers().length, 0);
    assert.deepEqual(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).length })), { local: 0, session: 0, databases: 0 });
    windowsRuns.push({ viewport: name, fixtures: ['parser-only PE32', 'parser-only NE'], executionOffered: false, profileExports: 2,
      runtimeRequests: 0, noSelectedDataInRequests: true, noStorage: true, traffic, errors, sockets, remainingWorkers: page.workers().length });
    await context.close();
  }
  const runtimeRuns = [];
  const workspaceRuns = [];
  for (const name of ['MEM.EXE', 'FREECOM.ZIP'] as const) {
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1100 } }), page = await context.newPage();
    const traffic: string[] = [], errors: string[] = [], sockets: string[] = [], workers: string[] = [];
    context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message)); page.on('websocket', socket => sockets.push(socket.url()));
    page.on('worker', worker => workers.push(worker.url()));
    const entry = name === 'MEM.EXE' ? 'MEM.EXE' : 'APP/COMMAND.COM';
    await selectFixture(page, name, entry);
    assert(traffic.every(request => !request.includes('/runtimes/')));
    const at = performance.now(); await start(page); const startupMs = Math.round(performance.now() - at);
    await mkdir('test-results', { recursive: true });
    let output: Buffer;
    if (name === 'MEM.EXE') {
      await command(page, 'MEM > MEMOUT.TXT'); output = await downloadGuest(page, 'MEMOUT.TXT');
      assert.match(output.toString(), /Conventional/); assert.match(output.toString(), /Extended \(XMS\)/);
      await command(page, 'TYPE MEMOUT.TXT');
    } else {
      await command(page, 'TYPE APP\\INPUT.TXT > COPY.TXT');
      assert.match((await downloadGuest(page, 'COPY.TXT')).toString(), /PHANTOM local package resource/);
      await command(page, 'ECHO PHANTOM DOS OK>OUTPUT.TXT'); output = await downloadGuest(page, 'OUTPUT.TXT');
      assert.equal(output.toString().trim(), 'PHANTOM DOS OK');
      await command(page, 'TYPE OUTPUT.TXT');
    }
    await page.frameLocator('iframe[title="DOS program framebuffer"]').getByLabel('DOS program screen').screenshot({ path: `test-results/production-${name}-framebuffer.png` });
    await page.screenshot({ path: `test-results/production-${name}.png` });
    await writeFile(`test-results/production-${name}.txt`, output);
    const stoppedAt = performance.now(); await page.getByRole('button', { name: 'Stop session' }).click();
    await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'stopped');
    const stopMs = Math.round(performance.now() - stoppedAt); assert(stopMs < 2000);
    await expect.poll(() => page.workers().length).toBe(0);
    // All fixed assets have already been cached; a new real worker must run offline.
    await context.setOffline(true); await start(page);
    await command(page, 'ECHO OFFLINE LOCAL OK>OFFLINE.TXT');
    assert.equal((await downloadGuest(page, 'OFFLINE.TXT')).toString().trim(), 'OFFLINE LOCAL OK');
    await page.getByRole('button', { name: 'Stop session' }).click();
    await expect.poll(() => page.workers().length).toBe(0);
    if (name === 'FREECOM.ZIP') {
      await context.setOffline(false); await start(page);
      await command(page, 'IPXNET CONNECT phantom-network.invalid');
      await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'error');
      await expect.poll(() => page.workers().length).toBe(0);
      await start(page); await command(page, 'ECHO RECOVERED>RETRY.TXT');
      assert.equal((await downloadGuest(page, 'RETRY.TXT')).toString().trim(), 'RECOVERED');
      await page.getByRole('button', { name: 'Stop session' }).click();
      await expect.poll(() => page.workers().length).toBe(0);
    }
    // Temporary runs must not have created an OPFS save.
    assert.equal(await page.evaluate(async () => {
      try { await (await navigator.storage.getDirectory()).getDirectoryHandle('phantom-workspace-v1'); return true; } catch { return false; }
    }), false);
    if (name === 'FREECOM.ZIP') {
      await start(page);
      await page.getByLabel('Choose a document for DOS').setInputFiles({ name: 'LOCAL.TXT', mimeType: 'text/plain', buffer: Buffer.from('PRODUCTION LOCAL DOCUMENT\r\n') });
      await expect(page.getByRole('status').filter({ hasText: 'Document imported into temporary' })).toBeVisible();
      await command(page, 'TYPE LOCAL.TXT > SAVED.TXT'); await command(page, 'ECHO EDITED IN DOS>>SAVED.TXT');
      const changed = await downloadGuest(page, 'SAVED.TXT');
      assert.equal(changed.toString(), 'PRODUCTION LOCAL DOCUMENT\r\nEDITED IN DOS\r\n');
      await page.getByRole('button', { name: 'Capture SAVED.TXT', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Working copy captured' })).toBeVisible();
      await page.getByRole('button', { name: 'Stop session' }).click();
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Workspace', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Enable browser storage for manual saves' }).check();
      await page.getByRole('checkbox', { name: 'Save application software', exact: true }).check();
      await page.getByRole('checkbox', { name: 'Save captured working files', exact: true }).check();
      await page.getByRole('button', { name: 'Save workspace', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Workspace saved in this browser origin' })).toBeVisible();
      await page.reload(); await expect(page.getByRole('status').filter({ hasText: 'Saved workspace found. Profile validated' })).toBeVisible();
      await expect(page.locator('iframe')).toHaveCount(0);
      await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Workspace restored and files re-inspected' })).toBeVisible();
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Compatibility', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Compatibility, with evidence' })).toBeVisible();
      const com = page.getByRole('checkbox', { name: /I have confirmed/ }); if (await com.count()) await com.check();
      await page.getByRole('link', { name: 'Configure launch' }).click(); await page.getByRole('button', { name: 'Use these settings and continue' }).click(); await start(page);
      assert.deepEqual(await downloadGuest(page, 'SAVED.TXT'), changed);
      await page.getByRole('button', { name: 'Stop session' }).click(); await expect.poll(() => page.workers().length).toBe(0);
      workspaceRuns.push({ fixture: name, liveImport: 'passed', guestEditAndExport: 'passed', explicitSoftwareAndDocumentsSave: 'passed',
        reloadAndRestore: 'passed', noAutomaticLaunch: true, restoredFileSha256: createHash('sha256').update(changed).digest('hex') });
    }
    assert.deepEqual(errors, []); assert.deepEqual(sockets, []);
    assert(traffic.every(request => request.startsWith(`GET ${origin}/`) || request.startsWith('GET blob:')));
    assert(!traffic.join('\n').match(/MEM\.EXE|FREECOM|COMMAND\.COM|INPUT\.TXT|PHANTOM DOS OK|OFFLINE LOCAL OK|phantom-network|LOCAL\.TXT|SAVED\.TXT|PRODUCTION LOCAL DOCUMENT/));
    assert.deepEqual(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).length, caches: (await caches.keys()).length })), { local: 0, session: 0, databases: 0, caches: 0 });
    runtimeRuns.push({ fixture: name, entry, startupMs, stopMs, outputSha256: createHash('sha256').update(output).digest('hex'), outputBytes: output.length, offlineRelaunch: 'passed', guestNetworkAttempt: name === 'FREECOM.ZIP' ? 'blocked, worker released, relaunch passed' : 'not attempted', workerUrls: workers, remainingWorkers: page.workers().length, traffic, sockets, errors });
    await context.close();
  }
  const demoRuns = [];
  for (const [layout, options] of [['desktop', { viewport: { width: 1440, height: 1000 } }], ['mobile', devices['Pixel 7']!]] as const) {
    const context = await browser.newContext(options), page = await context.newPage();
    const traffic: string[] = [], errors: string[] = [], sockets: string[] = [], workers: string[] = [];
    context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('websocket', socket => sockets.push(socket.url()));
    page.on('worker', worker => workers.push(worker.url()));
    for (const [title, file, entry, instruction, outputPath, expected] of [
      ['FreeDOS MEM', 'MEM.EXE', 'MEM.EXE', 'MEM > MEMOUT.TXT', 'MEMOUT.TXT', 'Largest executable program size'],
      ['FreeCOM', 'FREECOM.ZIP', 'APP/COMMAND.COM', 'ECHO HELLO FROM DOS>RESULT.TXT', 'RESULT.TXT', 'HELLO FROM DOS'],
    ]) {
      await page.goto(`${origin}/`);
      const began = Date.now();
      await page.getByRole('button', { name: `Try ${title}`, exact: true }).click();
      await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
      await page.getByRole('radio', { name: `Choose ${entry} as entrypoint`, exact: true }).check();
      await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
      await page.getByRole('link', { name: 'Configure launch' }).click();
      await page.getByRole('button', { name: 'Use these settings and continue' }).click();
      await expect(page.getByRole('region', { name: 'Demo instructions' })).toContainText(instruction!);
      await start(page); const launchMs = Date.now() - began;
      assert(launchMs < 60000, 'Automated journey exceeds the minute budget');
      await command(page, instruction!); const output = await downloadGuest(page, outputPath!);
      assert(output.toString('latin1').includes(expected!));
      await page.getByRole('button', { name: 'Stop session' }).click();
      await expect.poll(() => page.workers().length).toBe(0);
      demoRuns.push({ layout, fixture: file, launchMs, timing: 'automated; cold page/runtime assets on loopback, not human usability validation',
        outputBytes: output.length, outputSha256: createHash('sha256').update(output).digest('hex') });
    }
    const demos = traffic.filter(line => line.includes('/demos/'));
    assert.deepEqual(demos, [`GET ${origin}/demos/MEM.EXE `, `GET ${origin}/demos/FREECOM.ZIP `]);
    assert(!traffic.join('\n').match(/MEMOUT|RESULT\.TXT|HELLO FROM DOS|APP%2F|APP\/COMMAND/));
    assert(traffic.every(line => line.startsWith(`GET ${origin}/`) || line.startsWith('GET blob:')));
    assert.deepEqual(errors, []); assert.deepEqual(sockets, []); assert.equal(context.serviceWorkers().length, 0);
    demoRuns.push({ layout, traffic, workers, errors, sockets, remainingWorkers: page.workers().length });
    await context.close();
  }
  const security = await securityAcceptance(browser, origin, [...assets.keys()]);
  // Keep the audited vendor source bundle intact. Application maps and any
  // additional/unpinned maps must not ship; the retained map contains public
  // upstream sources, never selected files or PHANTOM application state.
  const sourceMapPaths = [...assets.keys()].filter(path => path.endsWith('.map'));
  assert.deepEqual(sourceMapPaths, ['/runtimes/js-dos/source/emulators.js.map']);
  const vendorManifest = JSON.parse(await readFile('vendor/dos/manifest.json', 'utf8'));
  const sourceMaps = sourceMapPaths.map(path => ({ path, sha256: createHash('sha256').update(assets.get(path)!).digest('hex'),
    purpose: 'Retained public upstream source; not an application source map' }));
  assert.equal(sourceMaps[0]!.sha256, vendorManifest.retained['vendor/dos/emulators.js.map'].sha256);
  const report = { scope: 'Production intake, profiles, disabled/unverified Windows path, real DOS execution, storage and hostile-content boundaries', browser: browser.version(), platform: `${process.platform}/${process.arch}`,
    csp: 'Preview and production share strict headers; only three fixed runtime and two fixed demo fetch URLs; opaque runtime frame/worker connect-src none', runs, windowsRuns, runtimeRuns, workspaceRuns, demoRuns, security,
    sourceMaps, assets: Object.fromEntries([...assets].map(([path, bytes]) => [path, createHash('sha256').update(bytes).digest('hex')])) };
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/production-smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
