import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mzFixture, peFixture, parserFixtures } from '../fixtures/probe-fixtures';
import { mixedPackageFiles, packageZip } from '../fixtures/package-fixtures';
import { profileFixture } from '../fixtures/planner-fixtures';

const test = base.extend<{ health: void }>({ health: [async ({ page }, use) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await use(); expect(errors).toEqual([]);
}, { auto: true }] });
async function analyze(page: Page, bytes: Uint8Array, name: string, choose = false) {
  await page.getByLabel('Choose a local file', { exact: true }).setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'unsupported');
  if (choose) await page.getByRole('radio', { name: `Choose ${name} as entrypoint`, exact: true }).check();
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
}
const visit = async (page: Page, name: string) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true }).click();
const importJSON = async (page: Page, profile: unknown) => {
  if (!page.url().endsWith('/workspace')) await visit(page, 'Configure');
  await page.getByLabel('Choose a launch profile JSON').setInputFiles({ name: 'PRIVATE_PROFILE.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(profile)) });
};

test('header-based candidate, keyboard override and reset never enable Run', async ({ page }) => {
  await page.goto('/#/inspect');
  await analyze(page, peFixture(), 'wrong-extension.com', true);
  await expect(page.getByTestId('compatibility-decision')).toHaveText('experimental');
  await page.getByText('Change runtime selection', { exact: true }).click();
  await expect(page.getByText('Automatic suggestion: boxedwine.', { exact: false })).toBeVisible();
  await expect(page.getByText('No runtime installed', { exact: true })).toBeVisible();
  const select = page.getByLabel('Adapter selection'); await select.focus();
  await expect(select).toBeFocused(); await select.selectOption('js-dos');
  await expect(page.getByTestId('compatibility-decision')).toHaveText('unsupported');
  await expect(page.getByText('The selected runtime override does not accept', { exact: false }).first()).toBeVisible();
  await select.selectOption('automatic');
  await expect(page.getByTestId('compatibility-decision')).toHaveText('experimental');
  await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('ambiguous ZIP asks for entrypoint, then replans for the chosen executable', async ({ page }) => {
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a ZIP archive').setInputFiles({ name: 'mixed.zip', mimeType: 'application/zip', buffer: Buffer.from(packageZip(mixedPackageFiles)) });
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByRole('radio')).toHaveCount(2);
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  await expect(page.getByText('The package has no chosen entrypoint.', { exact: false }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Back to file details' }).click();
  await page.getByRole('radio', { name: 'Choose APP/MAIN.EXE as entrypoint', exact: true }).check();
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  await page.getByText('Change runtime selection', { exact: true }).click();
  await expect(page.getByText('Automatic suggestion: js-dos.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Back to file details' }).click();
  await expect(page.getByRole('list', { name: 'Package files' }).getByRole('listitem')).toHaveCount(8);
});

test('imports missing dependencies, edits limits and exports a local JSON profile without content', async ({ page, context }) => {
  const traffic: string[] = [], sockets: string[] = [];
  context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  page.on('websocket', socket => socket.on('framesent', frame => sockets.push(String(frame.payload))));
  await page.goto('/#/inspect');
  await analyze(page, mzFixture(), 'PRIVATE_APP.EXE', true);
  const profile = { ...profileFixture('PRIVATE_APP.EXE'), requiredFiles: [{ path: 'PRIVATE_LIB.DLL', kind: 'library' }] };
  await importJSON(page, profile);
  await visit(page, 'Compatibility');
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  await expect(page.locator('.planner-issues')).toContainText('PRIVATE_LIB.DLL');
  await expect(page.locator('.planner-issues')).toContainText('declared library');
  await visit(page, 'Configure');
  await page.getByText('Edit controls, mounts and limits', { exact: true }).click();
  await page.getByLabel('Mouse mode').selectOption('absolute');
  await page.getByLabel('Guest memory (MiB)').fill('32');
  await page.getByLabel('Session limit (minutes)').fill('5');
  await page.getByRole('button', { name: 'Apply profile settings' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export profile JSON' }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe('phantom-launch-profile.json');
  const json = await readFile((await exported.path())!, 'utf8');
  expect(JSON.parse(json)).toMatchObject({ schemaVersion: 1, runtimeId: 'js-dos', runtimeVersion: null, entrypoint: 'PRIVATE_APP.EXE',
    controls: { mouse: 'absolute' }, limits: { guestMemoryMiB: 32, maxSessionMs: 300_000 }, requiredFiles: [{ path: 'PRIVATE_LIB.DLL', kind: 'library' }] });
  expect(json).not.toMatch(/base64|verificationRecordId|bytes|content|runtimeUrl/);
  await page.getByRole('button', { name: 'Reset profile' }).click();
  await visit(page, 'Compatibility');
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  await importJSON(page, JSON.parse(json));
  await visit(page, 'Compatibility');
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  expect([...traffic, ...sockets].join('\n')).not.toMatch(/PRIVATE_APP|PRIVATE_LIB|PRIVATE_PROFILE/);
  expect(traffic.every(line => line.startsWith('GET http://127.0.0.1:4176/') || line.startsWith('GET blob:http://127.0.0.1:4176/'))).toBe(true);
  expect(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, db: (await indexedDB.databases()).length }))).toEqual({ local: 0, session: 0, db: 0 });
  expect(page.workers()).toHaveLength(0); expect(context.serviceWorkers()).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unsupported EXE, MSI, ELF, Mac, ISO and 64-bit Windows retain inspection and profile export', async ({ page }) => {
  await page.goto('/#/inspect');
  for (const id of ['misleading-exe', 'elf32', 'iso', 'pe32plus']) {
    const fixture = parserFixtures.find(item => item.id === id)!;
    await analyze(page, fixture.bytes, fixture.name);
    await expect(page.getByTestId('compatibility-decision')).toHaveText('unsupported');
    await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
    await visit(page, 'Configure');
    await expect(page.getByRole('button', { name: 'Export profile JSON' })).toBeEnabled();
    await visit(page, 'Inspect');
    await expect(page.getByRole('heading', { name: `Header report: ${fixture.name}` })).toBeVisible();
  }
  for (const name of ['installer.msi', 'Mac.app']) {
    await analyze(page, new TextEncoder().encode('PRIVATE_CONTENT_NOT_A_PROGRAM'), name);
    await expect(page.getByTestId('compatibility-decision')).toHaveText('unsupported');
    await visit(page, 'Configure');
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export profile JSON' }).click();
    const json = await readFile((await (await download).path())!, 'utf8');
    expect(JSON.parse(json)).toMatchObject({ runtimeId: null, runtimeVersion: null, entrypoint: name });
    expect(json).not.toContain('PRIVATE_CONTENT_NOT_A_PROGRAM');
    await visit(page, 'Compatibility');
    await page.getByText('Change runtime selection', { exact: true }).click();
    await page.getByLabel('Adapter selection').selectOption('js-dos');
    await visit(page, 'Configure');
    const overriddenDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export profile JSON' }).click();
    const overriddenJSON = await readFile((await (await overriddenDownload).path())!, 'utf8');
    expect(JSON.parse(overriddenJSON)).toMatchObject({ runtimeId: 'js-dos', runtimeVersion: null, selectionMode: 'override' });
    await visit(page, 'Compatibility');
    await page.getByText('Change runtime selection', { exact: true }).click();
    await page.getByLabel('Adapter selection').selectOption('automatic');
  }
});

test('invalid imports preserve a working profile, reject forged verification and recover on reset', async ({ page }) => {
  await page.goto('/#/inspect'); await analyze(page, mzFixture(), 'MAIN.EXE', true);
  await importJSON(page, { ...profileFixture('MAIN.EXE'), entrypoint: '../escape.exe' });
  await expect(page.getByRole('status').filter({ hasText: 'profile path is unsafe' })).toBeVisible();
  await visit(page, 'Compatibility');
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  await importJSON(page, { ...profileFixture('MAIN.EXE'), verificationRecordId: 'claimed-success' });
  await expect(page.getByRole('status').filter({ hasText: 'unknown fields' })).toBeVisible();
  await visit(page, 'Compatibility');
  await expect(page.getByTestId('compatibility-decision')).not.toHaveText('verified-compatible');
  await importJSON(page, { ...profileFixture('MAIN.EXE'), runtimeVersion: 'absent', runtimeBuildId: 'absent' });
  await visit(page, 'Compatibility');
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  await expect(page.locator('.planner-issues')).toContainText('version/build is not installed');
  await visit(page, 'Configure');
  await page.getByRole('button', { name: 'Reset profile' }).click();
  await visit(page, 'Compatibility');
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
});

test('a profile can be imported before files and reload clears its temporary state', async ({ page }) => {
  await page.goto('/#/workspace');
  await importJSON(page, profileFixture('MAIN.EXE'));
  await expect(page.getByText('Profile imported.', { exact: false })).toBeVisible();
  await analyze(page, mzFixture(), 'MAIN.EXE');
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  await expect(page.getByText('Chosen entrypoint: MAIN.EXE', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Start with a file' })).toBeVisible();
  await visit(page, 'Configure');
  await expect(page.getByRole('button', { name: 'Export profile JSON' })).toBeDisabled();
});

test('COM confirmation remains separate from static recognition, and corrupt input remains invalid', async ({ page }) => {
  await page.goto('/#/inspect');
  await analyze(page, Uint8Array.of(1, 2, 3), 'UNKNOWN.COM', true);
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  await page.getByRole('checkbox', { name: 'I have confirmed from its documentation', exact: false }).check();
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  await expect(page.getByRole('link', { name: 'Configure launch' })).toBeVisible();
  await analyze(page, Uint8Array.of(4, 5, 6), 'OTHER.COM', true);
  await expect(page.getByRole('checkbox', { name: 'I have confirmed from its documentation', exact: false })).not.toBeChecked();
  await expect(page.getByTestId('compatibility-decision')).toHaveText('needs-files');
  await analyze(page, Uint8Array.of(0x4d, 0x5a, 0), 'CORRUPT.EXE');
  await expect(page.getByTestId('compatibility-decision')).toHaveText('invalid');
  await visit(page, 'Configure');
  await expect(page.getByRole('button', { name: 'Export profile JSON' })).toBeEnabled();
});
