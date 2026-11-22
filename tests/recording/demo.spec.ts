import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { start, command, downloadGuest } from '../fixtures/dos-browser';

test('unedited local FreeCOM selection, real input, file export and cleanup', async ({ page, context, browser }, info) => {
  const requests: { url: string; method: string; body: string }[] = [], errors: string[] = [];
  context.on('request', r => requests.push({ url: r.url(), method: r.method(), body: r.postData() ?? '' }));
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open legacy software', exact: true }).click();
  await page.getByLabel('Choose a local file', { exact: true }).setInputFiles(resolve('tests/fixtures/dos/FREECOM.ZIP'));
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await page.getByRole('radio', { name: 'Choose APP/COMMAND.COM as entrypoint', exact: true }).check();
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await page.getByRole('link', { name: 'Configure launch' }).click();
  await page.getByRole('button', { name: 'Use these settings and continue' }).click();
  await start(page);
  await command(page, 'TYPE APP\\INPUT.TXT');
  await command(page, 'ECHO HELLO FROM DOS>RESULT.TXT');
  await page.keyboard.press('Control+Alt+Escape');
  const output = await downloadGuest(page, 'RESULT.TXT');
  expect(output.toString()).toBe('HELLO FROM DOS\r\n');
  await writeFile(info.outputPath('RESULT.TXT'), output);
  await page.getByRole('button', { name: 'Stop session' }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
  expect(requests.every(r => r.method === 'GET' && !r.body &&
    (r.url.startsWith('http://127.0.0.1:4174/') || r.url.startsWith('blob:')))).toBe(true);
  expect(JSON.stringify(requests)).not.toMatch(/RESULT\.TXT|COMMAND\.COM|HELLO FROM DOS|APP%2F/);
  await writeFile(info.outputPath('observation.json'), JSON.stringify({
    date: new Date().toISOString(), capture: 'unedited Playwright video of actual local browser; no narration',
    browser: browser.version(), fixture: 'FreeCOM 0.86 / FREECOM.ZIP',
    exportSha256: createHash('sha256').update(output).digest('hex'), outputBytes: output.length,
    consoleErrors: errors, requests, remainingWorkers: page.workers().length,
    limitation: 'local production preview only; not public HTTPS or a published YouTube submission',
  }, null, 2));
});
