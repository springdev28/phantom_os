import { readFile, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { test, expect, demoCases, digest } from '../fixtures/acceptance';
import { selectFixture, start, command, downloadGuest } from '../fixtures/dos-browser';
import { elfFixture, neFixture, peFixture } from '../fixtures/probe-fixtures';
import { mixedPackageFiles, packageZip } from '../fixtures/package-fixtures';

for (const demo of demoCases) test(`${demo.program}: selected bytes, explicit entrypoint, three real launches, input and export`, async ({ page, observation }, info) => {
  await selectFixture(page, demo.file, demo.entrypoint);
  if (demo.file === 'FREECOM.ZIP') {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Configure', exact: true }).click();
    await page.getByText('Edit controls, mounts and limits', { exact: true }).click();
    await page.getByLabel('Mouse mode').selectOption('absolute');
    await page.getByRole('checkbox', { name: 'Enable audio if the adapter provides it' }).check();
    await page.getByRole('button', { name: 'Apply profile settings' }).click();
    await page.getByRole('button', { name: 'Use these settings and continue' }).click();
  }
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Configure', exact: true }).click();
  const profileDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export profile JSON' }).click();
  observation.profile = JSON.parse(await readFile((await (await profileDownload).path())!, 'utf8'));
  await page.getByRole('button', { name: 'Use these settings and continue' }).click();
  const cycles = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    const began = performance.now(); await start(page); const launchMs = performance.now() - began;
    let output: Buffer;
    if (demo.file === 'MEM.EXE') {
      await command(page, 'MEM > MEMOUT.TXT'); output = await downloadGuest(page, 'MEMOUT.TXT');
      expect(output.toString()).toMatch(/Conventional/); expect(output.toString()).toMatch(/Extended \(XMS\)/);
    } else {
      await command(page, 'TYPE APP\\INPUT.TXT > COPY.TXT');
      expect((await downloadGuest(page, 'COPY.TXT')).toString()).toContain('PHANTOM local package resource');
      await command(page, 'ECHO LOCAL COMPATIBILITY>RESULT.TXT'); output = await downloadGuest(page, 'RESULT.TXT');
      expect(output.toString()).toBe('LOCAL COMPATIBILITY\r\n');
      const frame = page.frameLocator('iframe');
      await frame.getByRole('button', { name: 'Enable audio' }).click();
      await command(page, 'TYPE APP\\BELL.TXT');
      await expect.poll(async () => Number(await page.getByTestId('runtime-metrics').getAttribute('data-audio-peak'))).toBeGreaterThan(0);
      await frame.getByLabel('DOS program screen').hover();
      await expect.poll(async () => Number(await page.getByTestId('runtime-metrics').getAttribute('data-mouse-events'))).toBeGreaterThan(0);
    }
    const metrics = await page.getByTestId('runtime-metrics').evaluate(e => ({ ...(e as HTMLElement).dataset }));
    if (cycle === 0) {
      const png = await page.frameLocator('iframe').getByLabel('DOS program screen').evaluate(e => (e as HTMLCanvasElement).toDataURL('image/png'));
      await writeFile(info.outputPath('framebuffer.png'), Buffer.from(png.split(',')[1]!, 'base64'));
    }
    const stopped = performance.now(); await page.getByRole('button', { name: 'Stop session' }).click();
    await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'stopped');
    await expect(page.locator('iframe')).toHaveCount(0); await expect.poll(() => page.workers().length).toBe(0);
    const stopMs = performance.now() - stopped; expect(stopMs).toBeLessThan(2000);
    cycles.push({ cycle, launchMs, stopMs, outputBytes: output.length, outputSha256: digest(output), metrics });
  }
  observation.demo = demo; observation.cycles = cycles;
  observation.keyboard = 'guest command results verified';
  observation.mouse = demo.file === 'FREECOM.ZIP' ? 'absolute input reaches engine; shell has no mouse UI' : 'not exercised';
  observation.audio = demo.file === 'FREECOM.ZIP' ? 'nonzero bell samples; not human listening' : 'disabled';
});

test('live document edit/export and explicit local save restore backup delete', async ({ page, observation }) => {
  await selectFixture(page, 'FREECOM.ZIP', 'APP/COMMAND.COM'); await start(page);
  await page.getByLabel('Choose a document for DOS').setInputFiles({ name: 'DOC.TXT', mimeType: 'text/plain', buffer: Buffer.from('LOCAL COMPATIBILITY\r\n') });
  await expect(page.getByRole('status').filter({ hasText: 'Document imported into temporary' })).toBeVisible();
  await command(page, 'TYPE DOC.TXT > RESULT.TXT'); await command(page, 'ECHO EDITED IN DOS>>RESULT.TXT');
  const expected = 'LOCAL COMPATIBILITY\r\nEDITED IN DOS\r\n';
  expect((await downloadGuest(page, 'RESULT.TXT')).toString()).toBe(expected);
  await page.getByRole('button', { name: 'Capture RESULT.TXT', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Working copy captured' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop session' }).click();
  const workspace = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Workspace', exact: true });
  await workspace.click();
  await page.getByRole('checkbox', { name: 'Enable browser storage for manual saves' }).check();
  await page.getByRole('checkbox', { name: 'Save application software', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Save captured working files', exact: true }).check();
  await page.getByRole('button', { name: 'Save workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Workspace saved in this browser origin' })).toBeVisible();
  const backup = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const entries = unzipSync(await readFile((await (await backup).path())!));
  expect(strFromU8(entries['documents/RESULT.TXT']!)).toBe(expected);
  const manifest = JSON.parse(strFromU8(entries['manifest.json']!)); observation.profile = manifest.profile;
  await page.reload(); await expect(page.getByRole('status').filter({ hasText: 'Saved workspace found. Profile validated' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Workspace restored and files re-inspected' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Compatibility', exact: true }).click();
  await page.getByRole('link', { name: 'Configure launch' }).click(); await page.getByRole('button', { name: 'Use these settings and continue' }).click(); await start(page);
  expect((await downloadGuest(page, 'RESULT.TXT')).toString()).toBe(expected);
  await page.getByRole('button', { name: 'Stop session' }).click(); await workspace.click();
  await page.getByRole('button', { name: 'Delete workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete workspace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workspace deleted' })).toBeVisible();
  await page.reload(); await expect(page.getByRole('status').filter({ hasText: 'No saved workspace' })).toBeVisible();
  observation.fileIo = { expected, sha256: digest(Buffer.from(expected)), liveExport: true, backup: true, reloadRestore: true, deletion: true };
});

test('ELF and PE64 stay unsupported; PE32 and NE keep Windows disabled', async ({ page, observation }) => {
  const cases = [];
  for (const [label, bytes, decision] of [['ELF', elfFixture(true), 'unsupported'], ['PE64', peFixture(true), 'unsupported'],
    ['PE32', peFixture(), 'experimental'], ['NE', neFixture(), 'experimental']] as const) {
    await page.goto('/#/inspect');
    const name = `PRIVATE_${label}.EXE`;
    await page.getByLabel('Choose a local file', { exact: true }).setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
    await expect(page.getByTestId('probe-report')).toBeVisible();
    await page.getByRole('radio', { name: `Choose ${name} as entrypoint`, exact: true }).check();
    await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
    await expect(page.getByTestId('compatibility-decision')).toHaveText(decision);
    await expect(page.getByRole('button', { name: 'Run unavailable' })).toBeDisabled();
    await page.getByRole('link', { name: 'Review or import launch settings' }).click();
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export profile JSON' }).click();
    const profile = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
    expect(profile.runtimeVersion).toBeNull(); await expect(page.locator('iframe, canvas')).toHaveCount(0);
    cases.push({ label, fixtureSha256: digest(bytes), recognitionOnly: true, decision, executionOffered: false });
  }
  observation.cases = cases;
});

test('ambiguous ZIP requires entrypoint choice and invalid input recovers', async ({ page, observation }) => {
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a ZIP archive').setInputFiles({ name: 'PRIVATE_BAD.ZIP', mimeType: 'application/zip', buffer: Buffer.from('invalid ZIP') });
  const badAt = performance.now();
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('ZIP is corrupt');
  const invalidFeedbackMs = performance.now() - badAt;
  await page.getByLabel('Choose a ZIP archive').setInputFiles({ name: 'PRIVATE_MIXED.ZIP', mimeType: 'application/zip', buffer: Buffer.from(packageZip(mixedPackageFiles)) });
  const mixedAt = performance.now();
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await expect(page.getByRole('radio')).toHaveCount(2); await expect(page.getByTestId('entrypoint-status')).toHaveText('No entrypoint selected');
  const entrypointFeedbackMs = performance.now() - mixedAt;
  await page.getByRole('radio', { name: 'Choose APP/MAIN.EXE as entrypoint', exact: true }).check();
  await expect(page.getByTestId('entrypoint-status')).toContainText('APP/MAIN.EXE');
  await expect(page.getByRole('list', { name: 'Package files' }).getByRole('listitem')).toHaveCount(8);
  await expect(page.locator('iframe')).toHaveCount(0);
  observation.commonErrors = ['corrupt archive: fixed message, fresh selection recovers', 'ambiguous package: no automatic executable'];
  observation.feedbackMs = { invalidFeedbackMs, entrypointFeedbackMs, scope: 'one sample; not a user error frequency study' };
});

test('missing storage and fullscreen retain temporary launch and export', async ({ page, observation }) => {
  await page.addInitScript(() => {
    if (window !== top) return;
    Object.defineProperty(navigator.storage, 'getDirectory', { value: undefined });
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined });
  });
  await selectFixture(page, 'MEM.EXE', 'MEM.EXE'); await start(page);
  await page.getByRole('button', { name: 'Full screen', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /full.screen.*(unavailable|not available|not supported)/i })).toBeVisible();
  await command(page, 'ECHO FALLBACK OK>RESULT.TXT'); expect((await downloadGuest(page, 'RESULT.TXT')).toString()).toBe('FALLBACK OK\r\n');
  await page.reload(); await expect(page.locator('iframe')).toHaveCount(0); await expect.poll(() => page.workers().length).toBe(0);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Enable browser storage for manual saves' })).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Browser storage is unavailable' })).toBeVisible();
  observation.fallback = { temporaryLaunch: true, guestExport: true, refreshCleanup: true, storage: 'deliberately absent', fullscreen: 'deliberately absent' };
});
