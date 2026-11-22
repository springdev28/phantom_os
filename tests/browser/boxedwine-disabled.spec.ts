import { test as base, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { peFixture, neFixture } from '../fixtures/probe-fixtures';
import { packageZip } from '../fixtures/package-fixtures';
import { profileFixture } from '../fixtures/planner-fixtures';
import { start, command, downloadGuest } from '../fixtures/dos-browser';

const test = base.extend<{ health: void }>({ health: [async ({ page }, use) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await use(); expect(errors).toEqual([]);
}, { auto: true }] });

test('PE32 and NE preserve reports/profiles while every Windows launch path stays disabled', async ({ page, context, browser }, info) => {
  const traffic: string[] = [], sockets: string[] = [];
  context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  const socketFrames: string[] = [];
  page.on('websocket', socket => {
    sockets.push(socket.url().replace(/\?token=.*/, '?token=[redacted]'));
    socket.on('framesent', frame => socketFrames.push(String(frame.payload)));
  });
  await page.goto('/#/inspect');
  const reports = [];
  for (const [format, bytes] of [['pe32', peFixture()], ['ne', neFixture()]] as const) {
    const name = `PRIVATE_${format}.COM`;
    await page.getByLabel('Choose a local file', { exact: true }).setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
    await page.getByRole('radio', { name: `Choose ${name} as entrypoint`, exact: true }).check();
    await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
    await expect(page.getByTestId('compatibility-decision')).toHaveText('experimental');
    await expect(page.locator('.planner-issues')).toContainText('Windows execution has not been verified');
    await expect(page.locator('.planner-issues')).toContainText('no component license/source inventory');
    await page.getByText('Change runtime selection', { exact: true }).click();
    await page.getByLabel('Adapter selection').selectOption('boxedwine');
    // A profile with the researched engine version cannot install or verify it.
    const forged = { ...profileFixture(name), runtimeId: 'boxedwine', runtimeVersion: '25R1', runtimeBuildId: '9279ab115e3c1e513aca4ea95aa30ea2f65258be' };
    await page.getByRole('link', { name: 'Review or import launch settings' }).click();
    await page.getByLabel('Choose a launch profile JSON').setInputFiles({ name: 'PRIVATE_PROFILE.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(forged)) });
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Compatibility', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
    await expect(page.locator('.planner-issues')).toContainText('version/build is not installed');
    await page.getByRole('link', { name: 'Review or import launch settings' }).click();
    await page.getByRole('button', { name: 'Reset profile' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export profile JSON' }).click();
    const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
    expect(exported).toMatchObject({ runtimeId: 'boxedwine', runtimeVersion: null, runtimeBuildId: null, entrypoint: name });
    expect(exported).not.toHaveProperty('bytes'); expect(exported).not.toHaveProperty('verificationRecordId');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Player', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Windows execution unverified', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Windows execution unavailable', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Stop session', exact: true })).toBeDisabled();
    await expect(page.locator('iframe, canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    reports.push({ format, parserOnly: true, fixtureSha256: createHash('sha256').update(bytes).digest('hex'),
      engineInstalled: false, executionOffered: false, profileExported: true, researchedVersionRejected: true });
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inspect', exact: true }).click();
  }
  expect(traffic.join('\n')).not.toMatch(/PRIVATE_|\/runtimes\/|boxedwine\/adapter|boxedwine\/bridge/);
  expect(traffic.every(line => line.startsWith('GET http://127.0.0.1:4176/'))).toBe(true);
  // Vite's development client opens its fixed local control socket even with HMR disabled.
  // Production coverage separately asserts zero sockets. No guest or package data goes here.
  expect(sockets.every(url => url === 'ws://127.0.0.1:4176/?token=[redacted]')).toBe(true);
  expect(socketFrames.join('\n')).not.toContain('PRIVATE_');
  expect(page.workers()).toHaveLength(0); expect(context.serviceWorkers()).toHaveLength(0);
  expect(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).length }))).toEqual({ local: 0, session: 0, databases: 0 });
  await writeFile(info.outputPath('boxedwine-disabled.json'), JSON.stringify({ browser: browser.version(), project: info.project.name,
    reports, noSelectedDataInRequests: true, noRuntimeRequests: true, noStorage: true, sockets, traffic }, null, 2));
});

test('Windows ZIP and folder use the same intake; selecting DOS afterwards still launches the real guest', async ({ page }, info) => {
  const text = new TextEncoder().encode('PRIVATE_SUPPORT_CONTENT');
  const zip = packageZip([{ path: 'WIN/MAIN.EXE', bytes: peFixture() }, { path: 'WIN/DATA.TXT', bytes: text }]);
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a ZIP archive').setInputFiles({ name: 'PRIVATE_WINDOWS.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await page.getByRole('button', { name: /^Analyze (file|package)$/ }).click();
  await page.getByRole('radio', { name: 'Choose WIN/MAIN.EXE as entrypoint', exact: true }).check();
  await expect(page.getByRole('list', { name: 'Package files' })).toContainText('WIN/DATA.TXT');
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
  const folder = info.outputPath('ChosenWindowsFolder'); await mkdir(folder);
  await writeFile(join(folder, 'MAIN.EXE'), peFixture()); await writeFile(join(folder, 'DATA.TXT'), text);
  await page.getByLabel('Choose a local folder').setInputFiles(folder);
  await page.getByRole('button', { name: /^Analyze (file|package)$/ }).click();
  await page.getByRole('radio', { name: 'Choose ChosenWindowsFolder/MAIN.EXE as entrypoint', exact: true }).check();
  await expect(page.getByRole('list', { name: 'Package files' })).toContainText('ChosenWindowsFolder/DATA.TXT');
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await expect(page.getByTestId('compatibility-decision')).toHaveText('experimental');
  await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
  // Return to automatic selection and the real licensed DOS fixture through the same shell.
  await page.getByLabel('Choose a local file', { exact: true }).setInputFiles('tests/fixtures/dos/MEM.EXE');
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await page.getByRole('radio', { name: 'Choose MEM.EXE as entrypoint', exact: true }).check();
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await page.getByRole('link', { name: 'Configure launch' }).click();
  await page.getByRole('button', { name: 'Use these settings and continue' }).click();
  await start(page);
  await command(page, 'MEM >RETRY.TXT');
  const bytes = await downloadGuest(page, 'RETRY.TXT'); expect(bytes.toString()).toContain('Largest executable program size');
  await page.getByRole('button', { name: 'Stop session', exact: true }).click();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'stopped');
  await expect(page.locator('iframe')).toHaveCount(0); expect(page.workers()).toHaveLength(0);
});
