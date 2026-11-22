import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { hostileArchives, hostileHeaders } from '../fixtures/security-fixtures';
import { peFixture } from '../fixtures/probe-fixtures';
import { command, downloadGuest, selectFixture, start } from '../fixtures/dos-browser';

test.setTimeout(90_000);
test('hostile PE, disk and ZIP inputs stay inert and recover without leaking metadata', async ({ page, context, browser }, info) => {
  const traffic: string[] = [], errors: string[] = [];
  context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/#/inspect');
  for (const item of hostileHeaders) {
    await page.getByLabel('Choose a local file', { exact: true }).setInputFiles({ name: item.name, mimeType: 'application/octet-stream', buffer: Buffer.from(item.bytes) });
    await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
    await expect(page.getByTestId('probe-report')).toContainText(item.diagnostic);
    await expect(page.getByRole('radio')).toHaveCount(0);
  }
  for (const item of hostileArchives) {
    await page.getByLabel('Choose a ZIP archive').setInputFiles({ name: `PRIVATE_${item.id}.ZIP`, mimeType: 'application/zip', buffer: Buffer.from(item.bytes) });
    await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(item.message);
    await expect(page.getByRole('list', { name: 'Package files' })).toHaveCount(0);
    await expect.poll(() => page.workers().length).toBe(0);
  }
  // React must render literal text, never decode metadata as markup.
  const name = '&lt;svg onload=alert(1)&gt;.EXE';
  await page.getByLabel('Choose a local file', { exact: true }).setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(peFixture()) });
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByRole('radio', { name: `Choose ${name} as entrypoint`, exact: true })).toBeVisible();
  await expect(page.locator('[onload], [onerror], script:not([src]):not([type="module"])')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(traffic.join('\n')).not.toMatch(/PRIVATE_|ARCHIVE_CONTENT|onload|onerror|\.EXE/);
  expect(context.serviceWorkers()).toHaveLength(0); expect(errors).toEqual([]);
  await writeFile(info.outputPath('security-intake.json'), JSON.stringify({ browser: browser.version(), project: info.project.name,
    hostileHeaders: hostileHeaders.map(f => f.name), rejectedArchives: hostileArchives.map(f => f.id), noDomInjection: true, traffic, errors }, null, 2));
});

test('refresh during actual DOS execution destroys the worker and does not restore temporary files', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await selectFixture(page, 'MEM.EXE', 'MEM.EXE'); await start(page);
  await command(page, 'ECHO PRIVATE TEMPORARY DATA>TEMP.TXT');
  expect((await downloadGuest(page, 'TEMP.TXT')).toString()).toContain('PRIVATE TEMPORARY DATA');
  const worker = page.workers().find(w => w.url().startsWith('blob:')); expect(worker).toBeDefined();
  const closed = worker!.waitForEvent('close'); await page.reload(); await closed;
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'idle');
  await expect(page.locator('iframe')).toHaveCount(0); await expect.poll(() => page.workers().length).toBe(0);
  await expect(page.getByRole('button', { name: 'Start DOS program', exact: true })).toBeDisabled();
  expect(context.serviceWorkers()).toHaveLength(0);
  await selectFixture(page, 'MEM.EXE', 'MEM.EXE'); await start(page);
  await page.getByRole('button', { name: 'Refresh guest files' }).click();
  await expect(page.getByRole('button', { name: 'Export MEM.EXE', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export TEMP.TXT', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop session' }).click(); expect(errors).toEqual([]);
});

test('silent real-worker termination is detected and a fresh session recovers', async ({ page }, info) => {
  await selectFixture(page, 'MEM.EXE', 'MEM.EXE'); await start(page);
  const worker = page.workers().find(w => w.url().startsWith('blob:')); expect(worker).toBeDefined();
  // Fault injection stops the actual emulator worker. No fake runtime events.
  const began = Date.now(); await worker!.evaluate(() => { setTimeout(() => self.close(), 0); });
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'error', { timeout: 12000 });
  const detectedMs = Date.now() - began;
  await expect(page.getByRole('status').filter({ hasText: 'DOS worker stopped after a failure' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await start(page); await command(page, 'ECHO RECOVERY OK>RECOVER.TXT');
  expect((await downloadGuest(page, 'RECOVER.TXT')).toString().trim()).toBe('RECOVERY OK');
  await page.getByRole('button', { name: 'Stop session' }).click();
  await writeFile(info.outputPath('security-lifecycle.json'), JSON.stringify({ project: info.project.name, fault: 'self.close() in actual emulator worker', silentWorkerFailureDetectedMs: detectedMs, freshRelaunchExport: true }, null, 2));
});

test('storage denial preserves a temporary real session and explicit export without host permissions', async ({ page, context }) => {
  await page.addInitScript(() => {
    if (window !== top) return; // Model denied app storage, not an extension patching the guest realm.
    Object.defineProperty(navigator.storage, 'getDirectory', { value: async () => { throw new DOMException('PRIVATE_STORAGE_DETAIL', 'NotAllowedError'); } });
    for (const name of ['showOpenFilePicker', 'showSaveFilePicker', 'showDirectoryPicker']) Object.defineProperty(window, name, { value: () => { throw new Error('Host filesystem permission must not be requested'); } });
    Object.defineProperty(navigator, 'clipboard', { value: { readText: async () => { throw new Error('Clipboard must not be read'); } } });
  });
  const errors: string[] = [], traffic: string[] = [];
  context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  page.on('pageerror', error => errors.push(error.message));
  await selectFixture(page, 'FREECOM.ZIP', 'APP/COMMAND.COM'); await start(page);
  await page.getByLabel('Choose a document for DOS').setInputFiles({ name: 'PRIVATE.TXT', mimeType: 'text/plain', buffer: Buffer.from('PRIVATE_DOCUMENT_CONTENT\r\n') });
  await expect(page.getByRole('status').filter({ hasText: 'Document imported into temporary' })).toBeVisible();
  await command(page, 'TYPE PRIVATE.TXT>RESULT.TXT');
  expect((await downloadGuest(page, 'RESULT.TXT')).toString()).toBe('PRIVATE_DOCUMENT_CONTENT\r\n');
  await page.getByRole('button', { name: 'Stop session' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'denied access' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Enable browser storage for manual saves' })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText('PRIVATE_STORAGE_DETAIL');
  expect(traffic.join('\n')).not.toMatch(/PRIVATE|RESULT\.TXT/); expect(errors).toEqual([]);
  expect(context.serviceWorkers()).toHaveLength(0);
});

test('the one-minute configured deadline stops a real guest, with no implicit save', async ({ page }, info) => {
  await selectFixture(page, 'MEM.EXE', 'MEM.EXE');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Configure', exact: true }).click();
  await page.getByText('Edit controls, mounts and limits', { exact: true }).click();
  await page.getByLabel('Session limit (minutes)').fill('1');
  await page.getByRole('button', { name: 'Apply profile settings' }).click();
  await page.getByRole('button', { name: 'Use these settings and continue' }).click(); await start(page);
  const began = Date.now();
  // Real wall clock and real worker; this acceptance does not advance a fake timer.
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'stopped', { timeout: 65000 });
  await expect(page.getByRole('status').filter({ hasText: 'session time limit was reached' })).toBeVisible();
  await expect.poll(() => page.workers().length).toBe(0); await expect(page.locator('iframe')).toHaveCount(0);
  await writeFile(info.outputPath('security-deadline.json'), JSON.stringify({ project: info.project.name, configuredMs: 60000, observedMsAfterFirstFrame: Date.now() - began, timersMocked: false }, null, 2));
});
