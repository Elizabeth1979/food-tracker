// Screen test: the main flows, clicked through like on a phone, in test mode (no sign-in, sample photo answer).
// Run: npm run test:screens. Starts `vite --mode demo` itself. Needs a Chromium: Playwright's
// (`npx playwright install chromium`) or one named by CHROMIUM_PATH.
// Elements are found the way a person (or a screen reader) finds them: by role and visible or accessible name,
// never by CSS class, so a redesign that keeps behavior keeps this test green.
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

// ---- the vocabulary of the app, by role and name ----
const button = (name, scope = page) => scope.getByRole('button', { name, exact: typeof name === 'string' });
const dialog = () => page.getByRole('dialog');
const mealTab = (name) => dialog().getByRole('group', { name: 'ארוחה' }).getByRole('button', { name: new RegExp(name) });
const meal = (label) => page.getByRole('region', { name: label });
const entries = (label) => meal(label).getByRole('button', { name: /^מחק: / }); // one delete button per entry
const openAdd = async () => { await button(/הוספה$/).tap(); await dialog().waitFor(); };
const sampleJpeg = () => page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 64; return c.toDataURL('image/jpeg').split(',')[1]; });

test('one ＋ opens the add window on the meal of the time of day', async () => {
  await openAdd();
  assert.equal(await mealTab('צהריים').getAttribute('aria-pressed'), 'true');
});

test('search, pick an amount, add', async () => {
  await dialog().getByRole('searchbox', { name: 'חיפוש' }).fill('ענבים');
  await button(/^ענבים/, dialog()).first().tap();
  await button('הוסף לארוחת צהריים', dialog()).tap();
  await button(/^סיום · נוספו 1/, dialog()).waitFor();
});

test('switch the meal, then a photo goes to the review list', async () => {
  await mealTab('ערב').tap();
  assert.equal(await mealTab('ערב').getAttribute('aria-pressed'), 'true');
  // any real image will do: test mode answers every photo with the same sample meal
  assert.ok(await dialog().getByLabel('צילום', { exact: true }).count()); // the camera has its own button
  await dialog().getByLabel('מהגלריה').setInputFiles({ name: 'meal.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(await sampleJpeg(), 'base64') });
  // while it's being read: a visible status, and the rest locked with the reason given
  await dialog().getByRole('status').filter({ hasText: 'מזהה מזונות בתמונה' }).waitFor();
  const next = button('המשך לבדיקה', dialog());
  assert.ok(await next.isDisabled());
  assert.equal(await page.locator(`#${await next.getAttribute('aria-describedby')}`.replace(/:/g, '\\:')).innerText(), 'אפשר להמשיך כשהזיהוי יסתיים');
  await dialog().getByRole('combobox', { name: 'מזון' }).first().waitFor();
});

test('add what the photo missed, then add all to the chosen meal', async () => {
  const foods = dialog().getByRole('combobox', { name: 'מזון' });
  const rows = await foods.count();
  await dialog().getByRole('textbox', { name: 'הוספת מזון לרשימה' }).fill('פיתה');
  await button('הוסף', dialog()).tap();
  assert.equal(await foods.count(), rows + 1);
  assert.match(await foods.last().evaluate((s) => s.selectedOptions[0].text), /^פיתה, פיתה ביס/);
  await button(`הוסף לארוחת ערב (${rows + 1})`, dialog()).tap();
  await button(/^סיום/, dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
});

test('the diary shows them under the right meals, with a total', async () => {
  assert.equal(await entries('ארוחת צהריים').count(), 1);
  assert.equal(await entries('ארוחת ערב').count(), 5); // 4 from the sample photo + the pita
  assert.ok(await page.getByText(/^נצרכו/).isVisible());
  assert.doesNotMatch(await page.getByText(/^נצרכו/).locator('..').innerText(), /נצרכו\s*0\b/);
});

test('tap an entry to change its amount and meal', async () => {
  await button(/^ענבים/, meal('ארוחת צהריים')).tap();
  await dialog().waitFor();
  await mealTab('ערב').tap();
  await dialog().getByRole('spinbutton').first().fill('20');
  await button('שמור', dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
  assert.equal(await entries('ארוחת צהריים').count(), 0);
  assert.equal(await entries('ארוחת ערב').count(), 6);
  assert.equal(await button(/^ענבים/, meal('ארוחת ערב')).filter({ hasText: /\b20 / }).count(), 1); // the photo had grapes too
});

test('delete an entry, then undo', async () => {
  await entries('ארוחת ערב').first().tap();
  assert.equal(await entries('ארוחת ערב').count(), 5);
  await button('בטל').tap();
  await page.waitForFunction(() => document.querySelectorAll('[aria-label^="מחק: "]').length === 6);
});

test('save a meal, then add it again in one tap', async () => {
  page.once('dialog', (d) => d.accept('ערב קבוע'));
  await button('שמור כארוחה', meal('ארוחת ערב')).tap();
  await page.getByText('"ערב קבוע" נשמרה').waitFor();
  await openAdd();
  await mealTab('נשנושים').tap();
  await button(/^ארוחה שמורה: ערב קבוע/, dialog()).tap(); // saved meals carry that prefix for screen readers
  await button(/^סיום · נוספו 6/, dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
  assert.equal(await entries('נשנושים ואחר').count(), 6);
});

test('moving between days', async () => {
  await button('יום קודם').tap();
  await page.getByText('היום', { exact: true }).waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('button', { name: /^מחק: / }).count(), 0); // yesterday is empty
  await button('יום הבא').tap();
  await page.getByText('היום', { exact: true }).waitFor();
  assert.equal(await entries('ארוחת ערב').count(), 6);
});

test('the phone back button closes a window, and returns from the reports tab to the diary', async () => {
  await openAdd();
  await page.keyboard.press('Escape'); // the same close request Android's back gesture sends
  await dialog().waitFor({ state: 'detached' });
  await button(/דוחות/).tap();
  assert.ok(await button(/CSV/).isEnabled()); // reports opened, and today's entries are in range
  await page.goBack();
  await button(/הוספה$/).waitFor();
});

test('the foods tab lists saved meals and the food database', async () => {
  await button(/מזונות/).tap();
  await page.getByRole('heading', { name: 'ארוחות שמורות' }).waitFor();
  assert.ok(await page.getByText('ערב קבוע').first().isVisible());
  await page.getByRole('heading', { name: /מאגר מזונות/ }).waitFor();
  // the food list stays closed until a search
  const grapes = page.getByRole('button', { name: /^הוסף ליומן: ענבים/ });
  assert.equal(await grapes.count(), 0);
  await page.getByRole('searchbox', { name: 'חיפוש במאגר' }).fill('ענבים');
  await grapes.first().waitFor();
});

test('a weigh-in updates the goals, and reports show the weight over time', async () => {
  const waist = () => page.getByRole('spinbutton', { name: /^מותניים/ });
  const weighIn = async (kg, cm) => {
    await button(/הגדרות/).tap();
    await page.getByRole('spinbutton', { name: 'משקל היום (ק״ג)' }).fill(kg);
    await waist().fill(cm);
    await button('שמור משקל ועדכן יעדים').tap();
    await page.getByRole('status').filter({ hasText: 'היעדים עודכנו' }).waitFor();
    await button(/יומן/).tap(); // leave, so the next visit starts fresh
  };
  // a week ago: the first weigh-in also needs age and height, once
  await page.clock.setFixedTime(new Date('2026-10-14T09:00:00'));
  await button(/הגדרות/).tap();
  await page.getByRole('spinbutton', { name: 'משקל היום (ק״ג)' }).fill('76');
  await waist().fill('90');
  assert.ok(await button('שמור משקל ועדכן יעדים').isDisabled());
  await page.getByRole('spinbutton', { name: 'גיל' }).fill('45');
  await page.getByRole('spinbutton', { name: 'גובה (ס״מ)' }).fill('165');
  await button('שמור משקל ועדכן יעדים').tap();
  await page.getByRole('status').filter({ hasText: 'היעדים עודכנו' }).waitFor();
  const kcalBefore = await page.getByRole('spinbutton', { name: 'קלוריות' }).inputValue();
  await button(/יומן/).tap();
  // today: age and height are remembered, the goals follow the new weight
  await page.clock.setFixedTime(new Date('2026-10-21T13:00:00'));
  await weighIn('75', '88');
  await button(/הגדרות/).tap();
  assert.equal(await page.getByRole('spinbutton', { name: 'חלבון (ג׳)' }).inputValue(), '123');
  assert.ok(Number(await page.getByRole('spinbutton', { name: 'קלוריות' }).inputValue()) < Number(kcalBefore));
  await button(/דוחות/).tap();
  await button('חודש').tap();
  await page.getByRole('img', { name: /^משקל: מ־76 ק״ג .* ל־75 ק״ג/ }).waitFor();
  await page.getByRole('img', { name: /^מותניים: מ־90 ס״מ .* ל־88 ס״מ/ }).waitFor();
});
