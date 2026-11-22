import { test as base, expect } from '@playwright/test';
import { parserFixtures } from '../fixtures/probe-fixtures';

const test = base.extend<{ health: void }>({
  health: [async ({ page, browser }, use, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    info.annotations.push({ type: 'browser-version', description: browser.version() });
    await use();
    expect(errors).toEqual([]);
  }, { auto: true }],
});
const fixture = (id: string) => {
  const value = parserFixtures.find(item => item.id === id);
  if (!value) throw new Error(`Missing parser fixture ${id}`);
  return { name: value.name, mimeType: 'application/octet-stream', buffer: Buffer.from(value.bytes) };
};

test('different selected bytes produce distinct reports with inspectable evidence', async ({ page }) => {
  await page.goto('/#/inspect');
  for (const [id, label, detail] of [
    ['dos-mz', 'DOS MZ image / stub', 'MZ signature'],
    ['pe32', 'PE32', 'Windows GUI'],
    ['pe32plus', 'PE32+', 'x86-64'],
    ['ne-os2', 'NE segmented image', 'OS/2 (declared NE target)'],
    ['elf64-big', 'ELF', '64-bit · big-endian'],
    ['iso', 'ISO 9660 image', 'ISO volume descriptor'],
    ['mbr', 'Possible MBR disk image', 'Boot-sector marker'],
    ['gpt', 'Possible GPT disk image', 'GPT signature'],
    ['raw-com', 'Possible raw COM (ambiguous)', 'COM_AMBIGUOUS'],
    ['misleading-exe', 'Unknown format', 'EXTENSION_ONLY'],
  ]) {
    await page.getByLabel('Choose a local file').setInputFiles(fixture(id!));
    await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
    await expect(page.getByTestId('probe-format')).toHaveText(label!);
    await expect(page.getByTestId('probe-report')).toContainText(detail!);
    await expect(page.getByRole('heading', { name: 'What this cannot establish' })).toBeVisible();
    await expect(page.locator('.evidence-list code').first()).not.toHaveText('');
    await expect(page.getByText('Supported', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const summary = page.locator('.evidence-panel summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.evidence-panel')).not.toHaveAttribute('open');
  await page.keyboard.press('Enter');
  await expect(page.locator('.evidence-panel')).toHaveAttribute('open');
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
});

test('all fixture analysis remains local, without page/worker requests or persisted reports', async ({ page, context }) => {
  const requests: string[] = [], frames: string[] = [], workers: string[] = [];
  context.on('request', request => requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  context.on('serviceworker', worker => workers.push(worker.url()));
  page.on('worker', worker => workers.push(worker.url()));
  page.on('websocket', socket => socket.on('framesent', event => frames.push(String(event.payload))));
  await page.goto('/#/inspect');
  await page.getByRole('heading', { name: 'No file selected' }).waitFor();
  await page.waitForLoadState('networkidle');
  const before = requests.length;
  // ZIP import has its own worker/privacy acceptance suite in Prompt 3.
  for (const item of parserFixtures.filter(item => item.format !== 'zip')) {
    const name = `PRIVATE_HEADER_SENTINEL_${item.name}`;
    await page.getByLabel('Choose a local file').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(item.bytes) });
    await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
    await expect(page.getByTestId('probe-report')).toBeVisible();
    const traffic = [...requests, ...frames].join('\n');
    expect(traffic).not.toContain(name);
    expect(traffic).not.toContain(encodeURIComponent(name));
    expect(traffic).not.toContain(Buffer.from(item.bytes).toString('base64'));
  }
  expect(requests.slice(before), 'Selecting/analyzing bytes should cause no requests at all').toEqual([]);
  expect(requests.every(request => request.startsWith('GET http://127.0.0.1:4176/'))).toBe(true);
  expect(workers).toEqual([]);
  expect(context.serviceWorkers()).toHaveLength(0);
  expect(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length,
    databases: (await indexedDB.databases()).length, caches: (await caches.keys()).length })))
    .toEqual({ local: 0, session: 0, databases: 0, caches: 0 });
});

test('corrupted data leaves a readable diagnostic and supports a fresh selection', async ({ page }) => {
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a local file').setInputFiles(fixture('corrupt-pe-pointer'));
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This header is incomplete or inconsistent');
  await expect(page.getByTestId('probe-report')).toContainText('outside the selected file');
  await expect(page.getByTestId('probe-report')).toContainText('INVALID_OFFSET');
  await page.getByLabel('Choose a local file').setInputFiles(fixture('pe32'));
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByTestId('probe-report')).toContainText('Checked fields agree');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a File read failure exposes a fixed human-readable error without private exception text', async ({ page }) => {
  await page.addInitScript(() => {
    Blob.prototype.arrayBuffer = async () => { throw new Error('PRIVATE_READ_ERROR_CONTENT'); };
  });
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a local file').setInputFiles(fixture('pe32'));
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The file could not be read');
  await expect(page.locator('body')).not.toContainText('PRIVATE_READ_ERROR_CONTENT');
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'error');
});
