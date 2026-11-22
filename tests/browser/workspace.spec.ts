import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { selectFixture, start, command, downloadGuest } from '../fixtures/dos-browser';

const rootName = 'phantom-workspace-v1';
const goWorkspace = async (page: import('@playwright/test').Page) => {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Keep only what you choose' })).toBeVisible();
};
const rootExists = (page: import('@playwright/test').Page) => page.evaluate(async name => {
  try { await (await navigator.storage.getDirectory()).getDirectoryHandle(name); return true; } catch { return false; }
}, rootName);
test.setTimeout(120_000);

test('real DOS live import, guest edit/export, opt-in OPFS save, reload, restore, backup and delete', async ({ page, context, browser }, info) => {
  const traffic: string[] = [], errors: string[] = [];
  context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await selectFixture(page, 'FREECOM.ZIP', 'APP/COMMAND.COM'); await start(page);
  expect(await rootExists(page)).toBe(false);
  await page.getByLabel('Choose a document for DOS').setInputFiles({ name: 'DOC.TXT', mimeType: 'text/plain', buffer: Buffer.from('LOCAL DOCUMENT SEVEN\r\n') });
  await expect(page.getByRole('status').filter({ hasText: 'Document imported into temporary' })).toBeVisible();
  await page.getByLabel('Choose a document for DOS').setInputFiles({ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('must not overwrite') });
  await expect(page.getByRole('status').filter({ hasText: 'Existing names are not overwritten' })).toBeVisible();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'running');
  expect((await downloadGuest(page, 'DOC.TXT')).toString()).toBe('LOCAL DOCUMENT SEVEN\r\n');
  await command(page, 'TYPE DOC.TXT > RESULT.TXT');
  await command(page, 'ECHO CHANGED INSIDE DOS>>RESULT.TXT');
  const expected = 'LOCAL DOCUMENT SEVEN\r\nCHANGED INSIDE DOS\r\n';
  expect((await downloadGuest(page, 'RESULT.TXT')).toString()).toBe(expected);
  await page.getByRole('button', { name: 'Capture RESULT.TXT', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Working copy captured' })).toBeVisible();
  const png = await page.frameLocator('iframe').getByLabel('DOS program screen').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL('image/png'));
  await info.attach('guest-document.png', { body: Buffer.from(png.split(',')[1]!, 'base64'), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Stop session' }).click(); await goWorkspace(page);
  await expect(page.getByRole('checkbox', { name: 'Enable browser storage for manual saves' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Save application software', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Save captured working files', exact: true })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Save workspace', exact: true })).toBeDisabled();
  expect(await rootExists(page)).toBe(false);
  await page.getByRole('checkbox', { name: 'Enable browser storage for manual saves' }).check();
  await page.getByRole('checkbox', { name: 'Save application software', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Save captured working files', exact: true }).check();
  await page.getByRole('button', { name: 'Save workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Workspace saved in this browser origin' })).toBeVisible();
  expect(await rootExists(page)).toBe(true);
  const backup = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const entries = unzipSync(await readFile((await (await backup).path())!));
  expect(strFromU8(entries['documents/RESULT.TXT']!)).toBe(expected);
  expect(entries['application/APP/COMMAND.COM']!.length).toBeGreaterThan(10000);
  expect(entries['application/APP/INPUT.TXT']).toBeDefined();
  const manifest = JSON.parse(strFromU8(entries['manifest.json']!));
  expect(manifest.application.saved).toBe(true);
  expect(manifest.documents[0].chunks[0]).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.parse(strFromU8(entries['launch-profile.json']!))).toEqual(manifest.profile);
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workspace found. Profile validated' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Workspace restored and files re-inspected' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove RESULT.TXT', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Compatibility', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compatibility, with evidence' })).toBeVisible();
  const com = page.getByRole('checkbox', { name: /I have confirmed/ }); if (await com.count()) await com.check();
  await page.getByRole('link', { name: 'Configure launch' }).click(); await page.getByRole('button', { name: 'Use these settings and continue' }).click(); await start(page);
  expect((await downloadGuest(page, 'RESULT.TXT')).toString()).toBe(expected);
  await command(page, 'ECHO RESTORED AND EDITED>>RESULT.TXT');
  const restored = (await downloadGuest(page, 'RESULT.TXT')).toString();
  expect(restored).toBe(`${expected}RESTORED AND EDITED\r\n`);
  await page.getByRole('button', { name: 'Stop session' }).click(); await goWorkspace(page);
  await page.getByRole('button', { name: 'Delete workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workspace deleted' })).toBeVisible();
  expect(await rootExists(page)).toBe(false);
  await page.reload(); await expect(page.getByRole('status').filter({ hasText: 'No saved workspace' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(traffic.filter(item => /DOC\.TXT|RESULT\.TXT|LOCAL DOCUMENT SEVEN|COMMAND\.COM|FREECOM\.ZIP|CHANGED INSIDE/.test(item))).toEqual([]);
  await info.attach('workspace-evidence.json', { body: JSON.stringify({ browser: browser.version(), project: info.project.name,
    operations: ['live-import', 'guest-edit', 'live-export', 'capture', 'opt-in-save', 'backup', 'reload', 'restore', 'guest-reedit', 'delete'],
    exportedResult: restored, manifest, errors, traffic }, null, 2), contentType: 'application/json' });
});

test('profile-only save requires original software and is isolated by origin', async ({ page, context }) => {
  await selectFixture(page, 'MEM.EXE', 'MEM.EXE'); await goWorkspace(page);
  await page.getByRole('checkbox', { name: 'Enable browser storage for manual saves' }).check();
  await page.getByRole('button', { name: 'Save workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Workspace saved' })).toBeVisible();
  const backup = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const entries = unzipSync(await readFile((await (await backup).path())!));
  expect(Object.keys(entries).sort()).toEqual(['launch-profile.json', 'manifest.json']);
  const manifest = JSON.parse(strFromU8(entries['manifest.json']!));
  expect(manifest.application.saved).toBe(false); expect(manifest.application.files[0].chunks).toBeNull();
  const other = await context.newPage(); await other.goto('http://localhost:4176/#/workspace');
  await expect(other.getByRole('status').filter({ hasText: 'No saved workspace' })).toBeVisible();
  expect(await rootExists(other)).toBe(false); await other.close();
  await page.reload(); await expect(page.getByRole('status').filter({ hasText: 'Original software was not saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'software bytes were not saved' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A fresh workspace' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Player', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start DOS program', exact: true })).toBeDisabled();
  expect(await page.locator('iframe').count()).toBe(0);
});

test('quota failure keeps the saved workspace and corrupt stored bytes cannot launch', async ({ page }) => {
  await selectFixture(page, 'MEM.EXE', 'MEM.EXE'); await goWorkspace(page);
  await page.getByRole('checkbox', { name: 'Enable browser storage for manual saves' }).check();
  await page.getByRole('checkbox', { name: 'Save application software', exact: true }).check();
  await page.getByRole('button', { name: 'Save workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Workspace saved' })).toBeVisible();
  const before = await page.evaluate(async name => (await (await (await navigator.storage.getDirectory()).getDirectoryHandle(name)).getFileHandle('head.json')).getFile().then(f => f.text()), rootName);
  await page.evaluate(() => { navigator.storage.estimate = async () => ({ usage: 1, quota: 1 }); });
  await page.getByRole('button', { name: 'Save workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'not enough browser storage' })).toBeVisible();
  expect(await page.evaluate(async name => (await (await (await navigator.storage.getDirectory()).getDirectoryHandle(name)).getFileHandle('head.json')).getFile().then(f => f.text()), rootName)).toBe(before);
  await page.reload(); await expect(page.getByRole('status').filter({ hasText: 'Saved workspace found' })).toBeVisible();
  await page.evaluate(async name => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(name);
    const head = JSON.parse(await (await (await directory.getFileHandle('head.json')).getFile()).text());
    const revision = await directory.getDirectoryHandle(head.revision as string);
    const handle = await revision.getFileHandle('a-0000'), original = await handle.getFile();
    const stream = await handle.createWritable(); await stream.write(new Uint8Array(original.size)); await stream.close();
  }, rootName);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'failed its manifest/file integrity checks' })).toBeVisible();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'idle');
  await expect(page.locator('iframe')).toHaveCount(0);
});

for (const failure of ['denied', 'unavailable'] as const) test(`${failure} OPFS retains temporary inspection and profile export`, async ({ page }) => {
  await page.addInitScript(mode => {
    if (mode === 'denied') navigator.storage.getDirectory = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
    else Object.defineProperty(navigator.storage, 'getDirectory', { value: undefined });
  }, failure);
  await selectFixture(page, 'MEM.EXE', 'MEM.EXE'); await goWorkspace(page);
  await expect(page.getByRole('status').filter({ hasText: failure === 'denied' ? 'browser denied access' : 'Browser storage is unavailable' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Enable browser storage for manual saves' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export profile JSON' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Save workspace', exact: true })).toBeDisabled();
});
