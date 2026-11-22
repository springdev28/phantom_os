import { test as base, expect } from '@playwright/test';

const test = base.extend<{ browserHealth: void }>({
  browserHealth: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use();
    expect(errors, 'No page exceptions or console errors').toEqual([]);
  }, { auto: true }],
});

const filename = 'PRIVATE_SELECTION_SENTINEL.exe';
const content = 'PHANTOM_LOCAL_CONTENT_SENTINEL: plain text, not an executable.';
const fixture = { name: filename, mimeType: 'application/octet-stream', buffer: Buffer.from(content) };

test('selects a local file, checks access, explains unavailable execution and clears the workspace', async ({ page }) => {
  const requests: string[] = [];
  const socketFrames: string[] = [];
  page.on('request', request => requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  page.on('websocket', socket => socket.on('framesent', event => socketFrames.push(String(event.payload))));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Open your software.See what can run.');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open legacy software', exact: true }).click();
  await (await chooser).setFiles(fixture);
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'selected');
  await expect(page.getByRole('heading', { level: 2, name: filename })).toBeVisible();
  await expect(page.getByText('Not inspected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'unsupported');
  await expect(page.getByText('Readable', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'No eligible execution path' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Player', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nothing is running' })).toBeVisible();
  await expect(page.locator('canvas, video, iframe')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.locator('.workspace-file')).toContainText(filename);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A fresh workspace' })).toBeVisible();
  expect([...requests, ...socketFrames].join('\n')).not.toContain(filename);
  expect([...requests, ...socketFrames].join('\n')).not.toContain(content);
  expect([...requests, ...socketFrames].join('\n')).not.toContain(Buffer.from(content).toString('base64'));
  expect(requests.every(request => request.startsWith('GET http://127.0.0.1:4176/'))).toBe(true);
  expect(page.context().serviceWorkers()).toHaveLength(0);
  expect(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length,
    databases: (await indexedDB.databases()).length, caches: (await caches.keys()).length })))
    .toEqual({ local: 0, session: 0, databases: 0, caches: 0 });
});

test('all six screens have accessible navigation, direct links and no horizontal overflow', async ({ page }) => {
  const screens = [
    ['home', 'Home', 'Open your software.See what can run.'],
    ['inspect', 'Inspect', 'Inspect your file'],
    ['compatibility', 'Compatibility', 'Compatibility, with evidence'],
    ['configure', 'Configure', 'Configure launch'],
    ['player', 'Player', 'Your program, running locally'],
    ['workspace', 'Workspace', 'Keep only what you choose'],
  ] as const;
  for (const [path, label, title] of screens) {
    await page.goto(`/#/${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto('/#/missing');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
});

test('keyboard selection is reachable and navigation transfers focus to the new heading', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Open legacy software', exact: true })).toBeFocused();
  const inspect = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inspect', exact: true });
  await inspect.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Inspect your file' })).toBeFocused();
});

test('a reload discards the temporary selection and selecting the same file again works', async ({ page }) => {
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a local file').setInputFiles(fixture);
  await expect(page.getByRole('heading', { level: 2, name: filename })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No file selected' })).toBeVisible();
  await page.getByLabel('Choose a local file').setInputFiles(fixture);
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'selected');
  await page.getByRole('button', { name: 'Clear selected file' }).click();
  await page.getByLabel('Choose a local file').setInputFiles(fixture);
  await expect(page.getByRole('heading', { level: 2, name: filename })).toBeVisible();
});

test('an empty file shows a recoverable error instead of a compatibility result', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Choose a local file').setInputFiles({ name: 'empty.exe', mimeType: '', buffer: Buffer.alloc(0) });
  await expect(page.getByRole('alert')).toContainText('This file is empty');
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'error');
  await page.getByLabel('Choose a local file').setInputFiles(fixture);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'selected');
});

test('loading is cancellable and an old read cannot revive a cleared selection', async ({ page }) => {
  // Delay the native file read, not its result, to exercise an observable pending state.
  await page.addInitScript(() => {
    const nativeRead = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function () {
      await new Promise(resolve => setTimeout(resolve, 500));
      return nativeRead.call(this);
    };
  });
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a local file').setInputFiles(fixture);
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Analyzing file…' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel analysis' }).click();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'selected');
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await page.getByRole('button', { name: 'Clear selected file' }).click();
  await expect(page.getByRole('heading', { name: 'No file selected' })).toBeVisible();
  // Allow both superseded native reads to settle before asserting no stale update.
  await page.waitForTimeout(650);
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'idle');
});
