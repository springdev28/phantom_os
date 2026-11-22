import { test as base, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { dosDescriptor } from '../../src/runtime/dos/descriptor';

export const machine = () => ({ platform: platform(), release: release(), architecture: arch(),
  cpu: cpus()[0]?.model ?? 'unavailable', logicalCpus: cpus().length, totalMemoryBytes: totalmem(), node: process.version });
export const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const demoCases = [
  { file: 'MEM.EXE', program: 'FreeDOS MEM', version: '1.12', input: 'single MZ executable', entrypoint: 'MEM.EXE' },
  { file: 'FREECOM.ZIP', program: 'FreeCOM', version: '0.86', input: 'ZIP; contained COMMAND.COM is MZ', entrypoint: 'APP/COMMAND.COM' },
] as const;

/** Only committed lawful fixtures and synthetic test data enter these records. */
export const test = base.extend<{ observation: Record<string, unknown> }>({
  observation: [async ({ page, context, browser, browserName }, use, info) => {
    const details: Record<string, unknown> = {};
    const requests: { method: string; url: string; body: string }[] = [], errors: string[] = [], sockets: string[] = [];
    context.on('request', r => requests.push({ method: r.method(), url: r.url(), body: r.postData() ?? '' }));
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('websocket', socket => sockets.push(socket.url()));
    await use(details);
    const fixtures = await Promise.all(demoCases.map(async demo => ({ ...demo, sha256: digest(await readFile(`tests/fixtures/dos/${demo.file}`)) })));
    const audit = { consoleClean: errors.length === 0, socketsAbsent: sockets.length === 0, serviceWorkersAbsent: context.serviceWorkers().length === 0,
      requestsLocal: requests.every(r => r.method === 'GET' && r.body === '' && (r.url.startsWith('http://127.0.0.1:4175/') || r.url.startsWith('blob:'))),
      noSelectedData: !/PRIVATE_|DOC\.TXT|RESULT\.TXT|COMMAND\.COM|APP%2F|LOCAL COMPATIBILITY/.test(JSON.stringify(requests)) };
    const result = { test: info.title, project: info.project.name, status: Object.values(audit).every(Boolean) ? info.status : 'failed', expectedStatus: info.expectedStatus,
      date: new Date().toISOString(), browser: { name: browserName, version: browser.version(), headless: true,
        channel: browserName === 'chromium' ? process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' : 'Playwright pinned Firefox' },
      machine: machine(), runtime: dosDescriptor, fixtures, details, audit, requests, errors, sockets,
      remainingWorkers: page.workers().length, serviceWorkers: context.serviceWorkers().length };
    await writeFile(info.outputPath('observation.json'), JSON.stringify(result, null, 2) + '\n');
    if (info.status === 'passed') {
      for (const [boundary, passed] of Object.entries(audit)) expect(passed, boundary).toBe(true);
    }
  }, { auto: true }],
});
export { expect };
