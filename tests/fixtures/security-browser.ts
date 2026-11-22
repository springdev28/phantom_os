import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { command, downloadGuest, selectFixture, start } from './dos-browser.ts';

/** Real production runtime first; deliberate browser-policy probes are recorded separately. */
export async function securityAcceptance(browser: Browser, origin: string, staticPaths: readonly string[]) {
  const context = await browser.newContext({ baseURL: origin }), page = await context.newPage();
  const traffic: { method: string; url: string; body: string; headers: Record<string, string> }[] = [];
  const pending: Promise<void>[] = [], errors: string[] = [], sockets: string[] = [], workerUrls: string[] = [];
  context.on('request', request => pending.push((async () => { traffic.push({ method: request.method(), url: request.url(),
    body: request.postDataBuffer()?.toString('base64') ?? '', headers: await request.allHeaders() }); })()));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('websocket', socket => sockets.push(socket.url())); page.on('worker', worker => workerUrls.push(worker.url()));
  try {
    const response = await page.goto(origin); assert(response);
    const headers = await response.allHeaders();
    assert.match(headers['content-security-policy']!, /worker-src blob:/);
    assert.match(headers['content-security-policy']!, /frame-ancestors 'none'/);
    assert(!headers['content-security-policy']!.includes('unsafe-eval'));
    assert(!headers['content-security-policy']!.match(/report-uri|report-to/));
    assert.equal(headers['x-content-type-options'], 'nosniff'); assert.equal(headers['referrer-policy'], 'no-referrer');
    assert.match(headers['permissions-policy']!, /clipboard-read=\(\)/);
    await selectFixture(page, 'MEM.EXE', 'MEM.EXE'); await start(page);
    await page.getByLabel('Choose a document for DOS').setInputFiles({ name: 'PRIVATE.TXT', mimeType: 'text/plain', buffer: Buffer.from('PRIVATE_SECURITY_DOCUMENT_V1\r\n') });
    await expect(page.getByRole('status').filter({ hasText: 'Document imported into temporary' })).toBeVisible();
    await command(page, 'TYPE PRIVATE.TXT>RESULT.TXT');
    assert.equal((await downloadGuest(page, 'RESULT.TXT')).toString(), 'PRIVATE_SECURITY_DOCUMENT_V1\r\n');
    const frame = page.frames().find(frame => frame.url().includes('/host-')); assert(frame);
    const isolation = await frame.evaluate(() => {
      const denied = (run: () => unknown) => { try { run(); return false; } catch { return true; } };
      const policy = (document as Document & { featurePolicy: { allowsFeature(name: string): boolean } }).featurePolicy;
      return { parentDomDenied: denied(() => parent.document.body), cookiesDenied: denied(() => document.cookie),
        localStorageDenied: denied(() => localStorage.length), storageAPIAbsent: navigator.storage === undefined,
        clipboardAbsent: navigator.clipboard === undefined, serviceWorkerAbsent: navigator.serviceWorker === undefined,
        hostPickerDenied: denied(() => (window as unknown as { showDirectoryPicker(): unknown }).showDirectoryPicker()),
        legacyRtcDenied: denied(() => new (window as unknown as { webkitRTCPeerConnection: new () => unknown }).webkitRTCPeerConnection()),
        permissionsDenied: ['camera', 'microphone', 'geolocation', 'clipboard-read', 'clipboard-write', 'usb', 'serial', 'hid'].every(name => !policy.allowsFeature(name)),
        policy: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') };
    });
    for (const [key, result] of Object.entries(isolation)) if (key !== 'policy') assert.equal(result, true, key);
    assert.match(isolation.policy!, /connect-src 'none'/);
    const worker = page.workers().find(worker => worker.url().startsWith('blob:')); assert(worker);
    const workerIsolation = await worker.evaluate(() => {
      const denied = (run: () => unknown) => { try { run(); return false; } catch { return true; } };
      const fs = (self as unknown as { Module: { FS: { open(path: string, mode: string): unknown;
        write(stream: unknown, bytes: Uint8Array, offset: number, length: number, position: number): void;
        close(stream: unknown): void; stat(path: string): { size: number }; unlink(path: string): void } } }).Module.FS;
      const path = '/home/web_user/package/LIMIT.TXT', stream = fs.open(path, 'w');
      const oversizedWriteDenied = denied(() => fs.write(stream, new Uint8Array([1]), 0, 1, 33554432));
      fs.close(stream); const noPartialOversizedWrite = fs.stat(path).size === 0; fs.unlink(path);
      return { fetchDenied: denied(() => fetch('https://invalid.example/worker-policy-probe')),
        socketDenied: denied(() => new WebSocket('wss://invalid.example/worker-policy-probe')),
        legacyRtcDenied: denied(() => new (self as unknown as { webkitRTCPeerConnection: new () => unknown }).webkitRTCPeerConnection()),
        importScriptsDenied: denied(() => (self as unknown as { importScripts(url: string): void }).importScripts('https://invalid.example/worker-policy-probe.js')),
        storageAPIAbsent: navigator.storage === undefined, indexedDbAbsent: indexedDB === undefined,
        cachesAbsent: caches === undefined, memoryOver256MiBDenied: denied(() => new WebAssembly.Memory({ initial: 4097 })),
        oversizedWriteDenied, noPartialOversizedWrite };
    });
    for (const [key, result] of Object.entries(workerIsolation)) assert.equal(result, true, key);
    const normalErrors = [...errors]; assert.deepEqual(normalErrors, []); assert.deepEqual(sockets, []);
    await page.getByRole('button', { name: 'Stop session' }).click(); await expect.poll(() => page.workers().length).toBe(0);
    await Promise.all(pending);
    const normalTraffic = [...traffic];
    assert(normalTraffic.every(request => request.method === 'GET' && request.body === '' && (request.url.startsWith(`${origin}/`) || request.url.startsWith('blob:'))));
    const allowed = new Set(['/', ...staticPaths]);
    assert(normalTraffic.every(request => request.url.startsWith('blob:') || (!new URL(request.url).search && allowed.has(new URL(request.url).pathname))));
    const serialized = JSON.stringify(normalTraffic);
    for (const secret of ['MEM.EXE', 'PRIVATE.TXT', 'RESULT.TXT', 'PRIVATE_SECURITY_DOCUMENT_V1']) {
      assert(!serialized.includes(secret)); assert(!serialized.includes(encodeURIComponent(secret))); assert(!serialized.includes(Buffer.from(secret).toString('base64')));
    }
    for (const bytes of [await readFile('tests/fixtures/dos/MEM.EXE'), Buffer.from('PRIVATE_SECURITY_DOCUMENT_V1\r\n')]) {
      assert(!serialized.includes(bytes.toString('base64'))); assert(!serialized.includes(bytes.toString('hex')));
      assert(!serialized.includes(createHash('sha256').update(bytes).digest('hex')));
    }
    assert(normalTraffic.every(request => !request.headers.authorization && !request.headers.cookie && !request.headers.referer));
    const temporary = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      let saved = false; try { await root.getDirectoryHandle('phantom-workspace-v1'); saved = true; } catch { /* Expected absent. */ }
      return { saved, local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).length,
        caches: (await caches.keys()).length, workers: (await navigator.serviceWorker.getRegistrations()).length };
    });
    assert.deepEqual(temporary, { saved: false, local: 0, session: 0, databases: 0, caches: 0, workers: 0 });

    // These use fixed, public test strings, never selected metadata. No request
    // may reach routing (the network boundary). CSP rejection diagnostics are expected.
    const escapedPolicyRequests: string[] = [];
    await context.route('**/*policy-probe*', route => { escapedPolicyRequests.push(route.request().url()); return route.abort(); });
    await page.evaluate(() => {
      const observed: string[] = []; (window as unknown as { policyViolations: string[] }).policyViolations = observed;
      document.addEventListener('securitypolicyviolation', event => observed.push(event.effectiveDirective));
    });
    const probes = await page.evaluate(async () => {
      let fetchDenied = false, serviceWorkerDenied = false, clipboardReadDenied = false;
      try { await fetch('https://invalid.example/phantom-policy-probe'); } catch { fetchDenied = true; }
      try { await navigator.serviceWorker.register('/policy-probe.js'); } catch { serviceWorkerDenied = true; }
      try { await navigator.clipboard.readText(); } catch { clipboardReadDenied = true; }
      const script = document.createElement('script'); script.textContent = 'globalThis.POLICY_PROBE_RAN = true'; document.head.append(script); script.remove();
      const child = document.createElement('iframe'); child.src = '/policy-probe.html'; document.body.append(child);
      return { fetchDenied, serviceWorkerDenied, clipboardReadDenied, inlineScriptBlocked: !('POLICY_PROBE_RAN' in globalThis) };
    });
    for (const [key, result] of Object.entries(probes)) assert.equal(result, true, key);
    await expect.poll(() => page.evaluate(() => (window as unknown as { policyViolations: string[] }).policyViolations.length)).toBeGreaterThanOrEqual(4);
    const violations = await page.evaluate(() => (window as unknown as { policyViolations: string[] }).policyViolations);
    for (const directive of ['connect-src', 'worker-src', 'script-src-elem', 'frame-src']) assert(violations.includes(directive), directive);
    assert.deepEqual(escapedPolicyRequests, []); assert.equal(context.serviceWorkers().length, 0);
    return { browser: browser.version(), hosting: 'unmodified Vite preview middleware and built HTML meta policy', headers,
      realGuestFileExport: true, isolation, workerIsolation, temporary, normalTraffic, normalErrors, workerUrls, sockets,
      probes, violations, escapedPolicyRequests, expectedPolicyDiagnostics: errors.slice(normalErrors.length) };
  } finally { await context.close(); }
}
