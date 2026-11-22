import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

import { selectFixture, start, command, downloadGuest } from '../fixtures/dos-browser';

test.setTimeout(90_000);
for (const name of ['MEM.EXE', 'FREECOM.ZIP'] as const) test(`real DOS worker: ${name}, input, guest files, stop and relaunch`, async ({ page, context, browser }, info) => {
  const errors: string[] = [], traffic: string[] = [], sockets: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  page.on('websocket', socket => sockets.push(socket.url()));
  const entry = name === 'MEM.EXE' ? 'MEM.EXE' : 'APP/COMMAND.COM';
  await selectFixture(page, name, entry);
  if (name === 'FREECOM.ZIP') {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Configure', exact: true }).click();
    await page.getByText('Edit controls, mounts and limits', { exact: true }).click();
    await page.getByLabel('Mouse mode').selectOption('absolute');
    await page.getByRole('checkbox', { name: 'Enable audio if the adapter provides it' }).check();
    await page.getByRole('button', { name: 'Apply profile settings' }).click();
    await page.getByRole('button', { name: 'Use these settings and continue' }).click();
  }
  expect(traffic.filter(url => url.includes('/runtimes/'))).toEqual([]);
  const began = Date.now(); await start(page); const startMs = Date.now() - began;
  if (name === 'MEM.EXE') {
    await command(page, 'MEM > MEMOUT.TXT');
    const output = (await downloadGuest(page, 'MEMOUT.TXT')).toString('latin1');
    expect(output).toMatch(/Conventional/i); expect(output).toMatch(/Extended|XMS/i);
    await info.attach('MEMOUT.TXT', { body: output, contentType: 'text/plain' });
    await command(page, 'TYPE MEMOUT.TXT');
  } else {
    const frame = page.frameLocator('iframe[title="DOS program framebuffer"]');
    await frame.getByRole('button', { name: 'Enable audio' }).click();
    await expect(frame.getByRole('button', { name: 'Mute audio' })).toBeVisible();
    await command(page, 'TYPE APP\\BELL.TXT');
    await expect.poll(async () => Number(await page.getByTestId('runtime-metrics').getAttribute('data-audio-peak'))).toBeGreaterThan(0);
    await frame.getByLabel('DOS program screen').hover();
    await expect.poll(async () => Number(await page.getByTestId('runtime-metrics').getAttribute('data-mouse-events'))).toBeGreaterThan(0);
    await command(page, 'TYPE APP\\INPUT.TXT');
    await command(page, 'TYPE APP\\INPUT.TXT > COPY.TXT');
    expect((await downloadGuest(page, 'COPY.TXT')).toString()).toContain('PHANTOM local package resource.');
    await command(page, 'ECHO PHANTOM DOS OK>OUTPUT.TXT');
    expect((await downloadGuest(page, 'OUTPUT.TXT')).toString().trim()).toBe('PHANTOM DOS OK');
    await command(page, 'TYPE OUTPUT.TXT');
  }
  // Chrome full-page captures can omit an opaque iframe's compositor surface.
  // Capture the real canvas directly; do not replace it with app-rendered text.
  await page.frameLocator('iframe[title="DOS program framebuffer"]').getByLabel('DOS program screen').screenshot({ path: info.outputPath('framebuffer.png') });
  await page.screenshot({ path: info.outputPath('running.png') });
  const metrics = await page.getByTestId('runtime-metrics').evaluate(element => ({ ... (element as HTMLElement).dataset }));
  const stopAt = Date.now(); await page.getByRole('button', { name: 'Stop session' }).click();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'stopped');
  const stopMs = Date.now() - stopAt; expect(stopMs).toBeLessThan(2000);
  const cycles = [{ startMs, stopMs }];
  await expect(page.locator('iframe')).toHaveCount(0);
  for (let cycle = 1; cycle < 3; cycle++) {
    const cycleStart = Date.now(); await start(page); const cycleStartMs = Date.now() - cycleStart;
    await page.getByRole('button', { name: 'Refresh guest files' }).click();
    await expect(page.getByRole('button', { name: 'Export OUTPUT.TXT', exact: true })).toHaveCount(0);
    await command(page, 'ECHO RELAUNCH OK>AGAIN.TXT');
    expect((await downloadGuest(page, 'AGAIN.TXT')).toString().trim()).toBe('RELAUNCH OK');
    const cycleStop = Date.now(); await page.getByRole('button', { name: 'Stop session' }).click();
    await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'stopped');
    const cycleStopMs = Date.now() - cycleStop; expect(cycleStopMs).toBeLessThan(2000);
    cycles.push({ startMs: cycleStartMs, stopMs: cycleStopMs });
    await expect.poll(() => page.workers().length).toBe(0);
  }
  expect(errors).toEqual([]);
  expect(sockets.every(url => url.startsWith('ws://127.0.0.1:4176/?token='))).toBe(true); // Vite's fixed developer socket only
  expect(traffic.filter(request => /MEM\.EXE|FREECOM|COMMAND\.COM|INPUT\.TXT|PHANTOM DOS OK|phantom-network/.test(request))).toEqual([]);
  const evidence = JSON.stringify({ browser: browser.version(), project: info.project.name, fixture: name, entry, startMs, stopMs, cycles, metrics, launchCycles: 3, errors, traffic, sockets }, null, 2);
  await writeFile(info.outputPath('runtime-evidence.json'), evidence);
  await info.attach('runtime-evidence.json', { body: evidence, contentType: 'application/json' });
});

test('a guest IPX connection attempt fails closed and the package can relaunch', async ({ page, context }) => {
  const traffic: string[] = [], sockets: string[] = [], errors: string[] = [];
  context.on('request', request => traffic.push(request.url()));
  page.on('websocket', socket => sockets.push(socket.url()));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await selectFixture(page, 'FREECOM.ZIP', 'APP/COMMAND.COM'); await start(page);
  // This pinned core aborts IPXNET when networking is disabled. The app must
  // release the worker and retain the selected package for a clean retry.
  await command(page, 'IPXNET CONNECT phantom-network.invalid');
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'error');
  await expect.poll(() => page.workers().length).toBe(0);
  await start(page); await command(page, 'ECHO RECOVERED>RETRY.TXT');
  expect((await downloadGuest(page, 'RETRY.TXT')).toString().trim()).toBe('RECOVERED');
  await page.getByRole('button', { name: 'Stop session' }).click();
  expect(traffic.some(url => url.includes('phantom-network'))).toBe(false);
  expect(sockets.every(url => url.startsWith('ws://127.0.0.1:4176/?token='))).toBe(true);
  expect(errors).toEqual([]);
});

test('offline asset error recovers, and leaving Player releases the real worker', async ({ page, context }) => {
  await selectFixture(page, 'MEM.EXE', 'MEM.EXE');
  await page.waitForLoadState('networkidle');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Start DOS program' }).click();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'error');
  await expect(page.getByRole('status').filter({ hasText: 'assets could not be loaded' })).toBeVisible();
  await context.setOffline(false); await start(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inspect', exact: true }).click();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'stopped');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect.poll(() => page.workers().length).toBe(0);
});
