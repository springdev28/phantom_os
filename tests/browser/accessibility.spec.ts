import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function contrast(page: Page) {
  return page.evaluate(() => {
    const rgb = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = (color: number[]) => color.map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; })
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index]!, 0);
    const ratio = (a: number[], b: number[]) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const background = (element: Element): number[] => {
      const color = getComputedStyle(element).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return rgb(color);
      return element.parentElement ? background(element.parentElement) : [17, 21, 16];
    };
    const text = Array.from(document.querySelectorAll('main *, aside *, header *, footer *')).filter(element => {
      return element.checkVisibility() && !element.closest('[disabled], [aria-disabled="true"], .sr-only') && Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
    }).map(element => {
      const style = getComputedStyle(element), size = parseFloat(style.fontSize), weight = parseFloat(style.fontWeight);
      return { text: element.textContent?.trim().slice(0, 90), ratio: ratio(rgb(style.color), background(element)),
        required: size >= 24 || size >= 18.66 && weight >= 700 ? 3 : 4.5 };
    });
    const fields = Array.from(document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), select, textarea')).filter(element => element.checkVisibility() && !element.closest('[disabled], .sr-only')).map(element => {
      const style = getComputedStyle(element);
      return { label: element.getAttribute('aria-label') ?? element.closest('label')?.textContent?.trim(), ratio: ratio(rgb(style.borderColor), background(element)) };
    });
    return { textCount: text.length, minTextRatio: Math.min(...text.map(item => item.ratio)), textFailures: text.filter(item => item.ratio < item.required), fields };
  });
}

test('keyboard flow, readable contrast, reduced motion and 200% layout', async ({ page, browser }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  const open = page.getByRole('button', { name: 'Open legacy software', exact: true });
  await expect(open).toBeFocused();
  expect(await open.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  expect(await open.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  const home = await contrast(page); expect(home.textFailures).toEqual([]);
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true });
  await page.getByRole('button', { name: 'Try FreeDOS MEM', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
  const choice = page.getByRole('radio', { name: 'Choose MEM.EXE as entrypoint', exact: true });
  await choice.focus(); await page.keyboard.press('Space'); await expect(choice).toBeChecked();
  await page.getByRole('link', { name: 'View compatibility', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const compatibility = await contrast(page); expect(compatibility.textFailures).toEqual([]);
  await page.getByRole('link', { name: 'Configure launch' }).click();
  await page.getByText('Edit controls, mounts and limits', { exact: true }).click();
  const configure = await contrast(page); expect(configure.textFailures).toEqual([]);
  expect(configure.fields.length).toBeGreaterThan(3); expect(configure.fields.every(field => field.ratio >= 3)).toBe(true);
  const original = page.viewportSize()!;
  // 200% text/controls via CSS zoom; viewport and all content must still reflow.
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expect(page.getByRole('button', { name: 'Use these settings and continue' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('configure-200.png'), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  await page.setViewportSize({ width: 320, height: original.height });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await writeFile(info.outputPath('accessibility.json'), JSON.stringify({ browser: browser.version(), project: info.project.name,
    home, compatibility, configure, keyboard: 'passed', reducedMotion: 'passed', cssZoom200: 'passed', reflow320: 'passed',
    screenReaderSpeech: 'not tested; DOM roles/focus tested only' }, null, 2));
});
