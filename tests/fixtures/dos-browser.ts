import { expect } from '@playwright/test';
import type { Download, Page } from '@playwright/test';
import { resolve } from 'node:path';

export async function selectFixture(page: Page, name: 'MEM.EXE' | 'FREECOM.ZIP', entrypoint: string) {
  await page.goto('/#/inspect');
  await page.getByLabel('Choose a local file', { exact: true }).setInputFiles(resolve('tests/fixtures/dos', name));
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  await page.getByRole('radio', { name: `Choose ${entrypoint} as entrypoint`, exact: true }).check();
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  const com = page.getByRole('checkbox', { name: /I have confirmed/ }); if (await com.count()) await com.check();
  await page.getByRole('link', { name: 'Configure launch' }).click();
  await page.getByRole('button', { name: 'Use these settings and continue' }).click();
  // Hash navigation does not await a lazy React screen. Offline tests must not
  // cut the connection before the Player chunk and its controls have mounted.
  await expect(page.getByRole('button', { name: 'Start DOS program', exact: true })).toBeEnabled();
}
export async function start(page: Page) {
  await page.getByRole('button', { name: /^(Start|Relaunch) DOS program$/ }).click();
  await expect(page.locator('[data-session-state]')).toHaveAttribute('data-session-state', 'running', { timeout: 35_000 });
  await expect.poll(async () => Number(await page.getByTestId('runtime-metrics').getAttribute('data-frames'))).toBeGreaterThan(0);
  const canvas = page.frameLocator('iframe[title="DOS program framebuffer"]').getByLabel('DOS program screen');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate(element => {
    const screen = element as HTMLCanvasElement;
    const pixels = screen.getContext('2d')!.getImageData(0, 0, screen.width, screen.height).data;
    let lit = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > 30) lit++;
    return lit;
  })).toBeGreaterThan(1000);
}
export async function command(page: Page, text: string) {
  await page.frameLocator('iframe[title="DOS program framebuffer"]').getByLabel('DOS program screen').focus();
  for (const char of text) {
    if (/[A-Z]/.test(char)) await page.keyboard.press(`Shift+Key${char}`, { delay: 35 });
    else if (char === '>') await page.keyboard.press('Shift+Period', { delay: 35 });
    else await page.keyboard.press(char === ' ' ? 'Space' : char, { delay: 35 });
  }
  await page.keyboard.press('Enter');
}
export async function downloadGuest(page: Page, path: string): Promise<Buffer> {
  await expect(async () => {
    await page.getByRole('button', { name: 'Refresh guest files' }).click();
    // The list is a snapshot, not a live subscription. Retry Refresh promptly
    // instead of waiting the default five seconds on a stale empty list.
    await expect(page.getByRole('button', { name: `Export ${path}`, exact: true })).toBeVisible({ timeout: 100 });
    await expect(page.getByRole('button', { name: `Export ${path}`, exact: true }).locator('..').locator('span')).not.toHaveText('0 bytes', { timeout: 100 });
  }).toPass({ timeout: 8000, intervals: [100, 200, 400] });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: `Export ${path}`, exact: true }).click();
  return downloadBytes(await download);
}
export async function downloadBytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Guest download stream is unavailable');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
