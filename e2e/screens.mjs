// Screen test: the main logging flow, clicked through like on a phone, in test mode (no sign-in, sample photo answer).
// Run: npm run test:screens. Starts `vite --mode demo` itself. Needs a Chromium: Playwright's
// (`npx playwright install chromium`) or one named by CHROMIUM_PATH.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 5175;
const URL = `http://localhost:${PORT}/`;
let server, browser, page;

before(async () => {
  server = spawn('npx', ['vite', '--mode', 'demo', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; ; i++) {
    try { if ((await fetch(URL)).ok) break; } catch { /* not up yet */ }
    if (i > 60) throw new Error('test-mode server did not start');
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  page = await browser.newPage({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true, locale: 'he-IL' });
  await page.clock.setFixedTime(new Date('2026-10-21T13:00:00')); // lunchtime: the add window starts on lunch
  await page.goto(URL);
});
after(async () => {
  await browser?.close();
  if (server) process.kill(-server.pid);
});

const dialog = () => page.locator('dialog[open]');
const tab = (name) => dialog().locator('.seg button', { hasText: name });

test('one ＋ opens the add window on the meal of the time of day', async () => {
  await page.locator('button.add-all').tap();
  await assert.doesNotReject(dialog().waitFor());
  assert.equal(await tab('צהריים').getAttribute('aria-pressed'), 'true');
});

test('search, pick an amount, add', async () => {
  await dialog().locator('input.search').fill('ענבים');
  await dialog().locator('button.row').first().tap();
  await dialog().getByRole('button', { name: 'הוסף לארוחת צהריים' }).tap();
  await assert.doesNotReject(dialog().locator('button.done', { hasText: 'נוספו 1' }).waitFor());
});

test('switch the meal, then a photo goes to the review list', async () => {
  await tab('ערב').tap();
  assert.equal(await tab('ערב').getAttribute('aria-pressed'), 'true');
  // any real image will do: test mode answers every photo with the same sample meal
  const jpeg = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 64; return c.toDataURL('image/jpeg').split(',')[1]; });
  await dialog().locator('input[type=file][capture]').setInputFiles({ name: 'meal.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
  await assert.doesNotReject(dialog().locator('.review-row').first().waitFor());
});

test('add what the photo missed, then add all to the chosen meal', async () => {
  const rows = await dialog().locator('.review-row').count();
  await dialog().getByLabel('הוספת מזון לרשימה').fill('פיתה');
  await dialog().getByRole('button', { name: 'הוסף', exact: true }).tap();
  assert.equal(await dialog().locator('.review-row').count(), rows + 1);
  assert.match(await dialog().locator('.review-row select[aria-label="מזון"]').last().evaluate((s) => s.selectedOptions[0].text), /^פיתה, פיתה ביס/);
  await dialog().getByRole('button', { name: `הוסף לארוחת ערב (${rows + 1})` }).tap();
  await dialog().locator('button.done').tap();
  await assert.doesNotReject(dialog().waitFor({ state: 'detached' }));
});

test('the diary shows them under the right meals, with a total', async () => {
  const meal = (name) => page.locator('section.meal', { hasText: name });
  assert.equal(await meal('ארוחת צהריים').locator('.row').count(), 1);
  assert.ok((await meal('ארוחת ערב').locator('.row').count()) >= 2);
  const eaten = Number(await page.locator('.kcal-line b').innerText());
  assert.ok(eaten > 0, `total ${eaten}`);
});
