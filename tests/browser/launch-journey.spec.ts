import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { start, command, downloadGuest } from '../fixtures/dos-browser';
import { peFixture } from '../fixtures/probe-fixtures';

test.setTimeout(60_000);
for (const demo of [
  { title: 'FreeDOS MEM', file: 'MEM.EXE', entry: 'MEM.EXE', command: 'MEM > MEMOUT.TXT', output: 'MEMOUT.TXT', expected: 'Largest executable program size' },
  { title: 'FreeCOM', file: 'FREECOM.ZIP', entry: 'APP/COMMAND.COM', command: 'ECHO HELLO FROM DOS>RESULT.TXT', output: 'RESULT.TXT', expected: 'HELLO FROM DOS' },
]) test(`guided first launch and export: ${demo.title}`, async ({ page, context, browser }, info) => {
  const errors: string[] = [], traffic: string[] = [], workers: string[] = [], socketFrames: string[] = [];
  context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('worker', worker => workers.push(worker.url()));
  page.on('websocket', socket => socket.on('framesent', frame => socketFrames.push(String(frame.payload))));
  await page.goto('/');
  await expect(page.locator('.button-primary')).toHaveCount(1);
  await expect(page.locator('.button-primary')).toHaveText('Open legacy software');
  const began = Date.now();
  await page.getByRole('button', { name: `Try ${demo.title}`, exact: true }).click();
  await expect(page.locator('.demo-guide')).toContainText(demo.entry);
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await page.getByRole('radio', { name: `Choose ${demo.entry} as entrypoint`, exact: true }).check();
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  const confirmation = page.getByRole('checkbox', { name: /I have confirmed/ }); if (await confirmation.count()) await confirmation.check();
  await page.getByRole('link', { name: 'Configure launch' }).click();
  await expect(page.getByRole('navigation', { name: 'Launch steps' }).getByRole('link', { name: 'Configure' })).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Use these settings and continue' }).click();
  expect(traffic.filter(line => line.includes('/runtimes/'))).toEqual([]);
  await expect(page.getByRole('region', { name: 'Demo instructions' })).toContainText(demo.command);
  await start(page);
  const launchMs = Date.now() - began;
  expect(launchMs).toBeLessThan(60_000); // Automated path only; not a novice-user timing claim.
  await page.getByRole('button', { name: 'Focus program', exact: true }).click();
  await expect(page.getByTestId('input-focus')).toHaveText('Keyboard: program focused');
  await page.keyboard.press('Control+Alt+Escape');
  await expect(page.getByTestId('input-focus')).toHaveText('Keyboard: browser controls');
  await page.getByRole('button', { name: 'Focus program', exact: true }).click();
  await expect(page.getByTestId('input-focus')).toHaveText('Keyboard: program focused');
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('input-focus')).toHaveText('Keyboard: browser controls');
  await page.getByRole('button', { name: 'Full screen', exact: true }).click();
  const fullscreen = await page.evaluate(() => document.fullscreenEnabled);
  if (fullscreen) {
    await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
    expect(await page.evaluate(() => document.fullscreenElement?.classList.contains('player-panel'))).toBe(true);
    await page.getByRole('button', { name: 'Exit full screen' }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  } else await expect(page.getByRole('status').filter({ hasText: 'Full screen is unavailable' })).toBeVisible();
  await command(page, demo.command);
  const bytes = await downloadGuest(page, demo.output);
  expect(bytes.toString('latin1')).toContain(demo.expected);
  // Read the real canvas pixels: Chrome can stop iframe animation frames after
  // a fullscreen transition, making Playwright's screenshot stability wait hang.
  const png = await page.frameLocator('iframe[title="DOS program framebuffer"]').getByLabel('DOS program screen').evaluate(element => (element as HTMLCanvasElement).toDataURL('image/png'));
  await writeFile(info.outputPath('real-framebuffer.png'), Buffer.from(png.split(',')[1]!, 'base64'));
  await page.screenshot({ path: info.outputPath('guided-player.png'), fullPage: true });
  await page.getByRole('button', { name: 'Stop session' }).click();
  await expect(page.locator('iframe')).toHaveCount(0); await expect.poll(() => page.workers().length).toBe(0);
  await start(page); await page.getByRole('button', { name: 'Stop session' }).click();
  const publicRequests = traffic.filter(line => line.includes('/demos/'));
  expect(publicRequests).toEqual([`GET http://127.0.0.1:4176/demos/${demo.file} `]);
  expect(traffic.every(line => line.startsWith('GET http://127.0.0.1:4176/') || line.startsWith('GET blob:'))).toBe(true);
  expect(traffic.join('\n') + socketFrames.join('\n')).not.toMatch(/MEMOUT|RESULT\.TXT|HELLO FROM DOS|APP%2F|APP\/COMMAND/);
  expect(workers.length).toBeGreaterThan(0); expect(errors).toEqual([]);
  await writeFile(info.outputPath('journey.json'), JSON.stringify({ browser: browser.version(), project: info.project.name,
    fixture: demo.file, entrypoint: demo.entry, launchMs, timing: 'automated, not human usability validation',
    outputBytes: bytes.length, outputSha256: createHash('sha256').update(bytes).digest('hex'),
    fullscreen, focusAndEscape: 'passed', relaunch: 'passed', workers, traffic, errors }, null, 2));
});

test('unsupported architecture has a copyable report and a denied-clipboard fallback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const traffic: string[] = [];
  context.on('request', request => traffic.push(`${request.url()} ${request.postData() ?? ''}`));
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a local file', { exact: true }).setInputFiles({ name: 'PRIVATE_64BIT.EXE', mimeType: '', buffer: Buffer.from(peFixture(true)) });
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await expect(page.getByTestId('compatibility-decision')).toHaveText('unsupported');
  await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
  await page.getByRole('button', { name: 'Copy compatibility report' }).click();
  // The application intentionally cannot read the clipboard. A separate,
  // test-owned blank document verifies the native write without weakening its policy.
  const observer = await context.newPage();
  await observer.route('**/clipboard-observer', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Clipboard test observer</title>' }));
  await observer.goto('/clipboard-observer');
  const copied = await observer.evaluate(() => navigator.clipboard.readText());
  await observer.close(); await page.bringToFront();
  expect(copied).toContain('Detected format: pe32+');
  expect(copied).toContain('Launch offered: no');
  expect(copied).toContain('64');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.getByRole('button', { name: 'Copy compatibility report' }).click();
  await expect(page.getByLabel('Compatibility report text')).toHaveValue(copied);
  await expect(page.getByLabel('Compatibility report text')).toBeFocused();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download report' }).click();
  expect(await readFile((await (await download).path())!, 'utf8')).toBe(copied);
  expect(traffic.join('\n')).not.toContain('PRIVATE_64BIT');
});

test('file drop, folder-drop guidance, picker fallback and large-file feedback', async ({ page, context }, info) => {
  await page.goto('/');
  await page.getByRole('region', { name: 'Open software', exact: true }).evaluate(element => {
    const transfer = new DataTransfer(); transfer.items.add(new File(['selected local bytes'], 'DROPPED.txt'));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer, cancelable: true }));
  });
  await expect(page.getByRole('heading', { name: 'DROPPED.txt', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  const folder = info.outputPath('DroppedFolder'); await mkdir(folder);
  await writeFile(`${folder}/README.txt`, 'Local folder drop fixture');
  const zone = page.getByRole('region', { name: 'Open software', exact: true });
  await zone.scrollIntoViewIfNeeded(); const box = (await zone.boundingBox())!;
  const client = await context.newCDPSession(page);
  for (const type of ['dragEnter', 'dragOver', 'drop'] as const) await client.send('Input.dispatchDragEvent', {
    type, x: box.x + box.width / 2, y: box.y + box.height / 2,
    data: { items: [], files: [folder], dragOperationsMask: 1 },
  });
  await client.detach();
  await expect(page.getByRole('status').filter({ hasText: 'Folder drops are not imported' })).toBeVisible();
  // Simulate a browser that has no directory picker; the file picker is still usable.
  await page.evaluate(() => { delete (HTMLInputElement.prototype as unknown as { webkitdirectory?: unknown }).webkitdirectory; });
  await page.getByRole('button', { name: 'Choose folder', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Folder selection is unavailable' })).toBeVisible();
  const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Open legacy software', exact: true }).click();
  await (await chooser).setFiles({ name: 'LARGE.img', mimeType: '', buffer: Buffer.alloc(17 * 1024 * 1024) });
  await expect(page.locator('.large-file-note')).toContainText('32 MiB');
  await expect(page.locator('.large-file-note')).toContainText('17');
});

test('runtime download progress is visible and full-screen denial preserves the real session', async ({ page }) => {
  await page.route('**/runtimes/js-dos/8.5.3/emulators.js', async route => {
    await new Promise(resolve => setTimeout(resolve, 800)); await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try FreeDOS MEM', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await page.getByRole('radio', { name: 'Choose MEM.EXE as entrypoint', exact: true }).check();
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await page.getByRole('link', { name: 'Configure launch' }).click();
  await page.getByRole('button', { name: 'Use these settings and continue' }).click();
  const launched = start(page);
  await expect(page.getByRole('status').filter({ hasText: 'Loading DOS runtime' })).toContainText('1.6 MiB');
  await launched;
  // Browser-feature fault injection, with the real runtime kept intact.
  await page.evaluate(() => Object.defineProperty(document, 'fullscreenEnabled', { value: false }));
  await page.getByRole('button', { name: 'Full screen', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Full screen is unavailable' })).toBeVisible();
  await command(page, 'ECHO STILL RUNNING>OK.TXT');
  expect((await downloadGuest(page, 'OK.TXT')).toString().trim()).toBe('STILL RUNNING');
  await page.getByRole('button', { name: 'Stop session' }).click();
});
