// Screen test: the main flows, clicked through like on a phone, in test mode (no sign-in, sample photo answer).
// Run: npm run test:screens. Starts `vite --mode demo` itself. Needs a Chromium: Playwright's
// (`npx playwright install chromium`) or one named by CHROMIUM_PATH.
// Elements are found the way a person (or a screen reader) finds them: by role and visible or accessible name,
// never by CSS class, so a redesign that keeps behavior keeps this test green.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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
  // the photo waits for an optional note (what a photo can't tell), then it's read
  await dialog().getByRole('textbox', { name: /^הערה/ }).fill('גבינה בולגרית מגורדת');
  await button('זהה מזונות', dialog()).tap();
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
  // the photo got a food wrong and the matches don't have it: search the whole database instead
  await foods.first().selectOption('?');
  await dialog().getByRole('searchbox', { name: 'חיפוש מזון אחר' }).fill('גבינה בולגרית');
  await dialog().getByRole('button', { name: /^גבינה בולגרית/ }).first().tap();
  assert.match(await foods.first().evaluate((s) => s.selectedOptions[0].text), /^גבינה בולגרית/);
  await dialog().getByRole('textbox', { name: 'הוספת מזון לרשימה' }).fill('פיתה');
  await button('הוסף', dialog()).tap();
  assert.equal(await foods.count(), rows + 1);
  assert.match(await foods.last().evaluate((s) => s.selectedOptions[0].text), /^פיתה, פיתה ביס/);
  await button(`הוסף לארוחת ערב (${rows + 1})`, dialog()).tap();
  await button(/^סיום/, dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
});

test('the meal photo is kept with the meal; a backup carries it; delete, then restore it', async () => {
  const photo = button('תמונה 1: ארוחת ערב', meal('ארוחת ערב'));
  await photo.tap();
  assert.ok(await dialog().getByRole('img', { name: 'הארוחה שצולמה' }).isVisible());
  await button('סגור', dialog()).tap();
  // the backup file holds the photo itself
  await button(/הגדרות/).tap();
  const [download] = await Promise.all([page.waitForEvent('download'), button('הורדת גיבוי').tap()]);
  const backup = await readFile(await download.path());
  const { Photo } = JSON.parse(backup.toString());
  assert.equal(Photo.length, 1);
  assert.match(Photo[0].path, /^\d{4}-\d\d-\d\d\/dinner\..+\.jpg$/);
  assert.ok(Photo[0].jpeg.length > 100);
  // delete it, and restoring the backup brings it back
  await button('יומן').tap();
  await photo.tap();
  page.once('dialog', (d) => d.accept());
  await button('מחק תמונה', dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
  assert.equal(await photo.count(), 0);
  await button(/הגדרות/).tap();
  page.once('dialog', (d) => d.accept());
  await Promise.all([page.waitForEvent('load'), page.getByLabel('שחזור מגיבוי').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup })]);
  await button('יומן').tap();
  await photo.waitFor();
});

test('the diary shows them under the right meals, with a total', async () => {
  assert.equal(await entries('ארוחת צהריים').count(), 1);
  assert.equal(await entries('ארוחת ערב').count(), 5); // 4 from the sample photo + the pita
  assert.ok(await page.getByText(/^נצרכו/).isVisible());
  assert.doesNotMatch(await page.getByText(/^נצרכו/).locator('..').innerText(), /נצרכו\s*0\b/);
  // the two daily goals: protein a minimum to reach, carbs a limit to stay under; fat is left to Reports
  const summary = page.getByRole('region', { name: 'סיכום היום' });
  // not tailored yet: the nutrition-label defaults, marked as general, with a way to tailor them
  assert.match(await summary.innerText(), /חלבון[\s\S]*\/ לפחות 50 ג׳[\s\S]*פחמימות[\s\S]*\/ עד 275 ג׳/);
  assert.ok(await summary.getByText(/^יעדים כלליים/).isVisible());
  assert.match(await summary.innerText(), /פחמימות[\s\S]*שומן[\s\S]*\/ 78 ג׳/); // fat last, for reference
  // where the goals come from, with the guidance tables
  await page.getByText('איך נקבעו היעדים?').tap();
  assert.equal(await summary.getByRole('table').count(), 2);
  await page.getByText('איך נקבעו היעדים?').tap();
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
  // saved meals have their own titled group; the usual foods show up to 5, the rest behind "עוד"
  await button(/^ערב קבוע/, dialog().getByRole('region', { name: 'ארוחות שמורות' })).tap();
  const usual = dialog().getByRole('region', { name: 'הרגילים שלך בנשנושים' });
  const picks = usual.getByRole('button', { name: /^הוסף: / });
  assert.equal(await picks.count(), 5); // the 5 foods logged so far: all shown, so no "עוד"
  assert.equal(await button(/^עוד \d/, usual).count(), 0);
  await button(/^סיום · נוספו 6/, dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
  assert.equal(await entries('נשנושים ואחר').count(), 6);
});

test('a usual food: ＋ adds last time\'s amount; its name opens the amount picker, filled with it', async () => {
  await openAdd();
  const usual = dialog().getByRole('region', { name: /^הרגילים שלך/ });
  const grapes = button(/^ענבים/, usual);
  const amount = async () => (await grapes.innerText()).split('\n')[1].split(' ')[0]; // the amount line under the name
  const last = await amount();
  await grapes.tap();
  const qty = dialog().getByRole('spinbutton');
  assert.equal(await qty.inputValue(), last);
  await qty.fill(String(Number(last) * 2));
  await button('הוסף לארוחת צהריים', dialog()).tap();
  const plus = button(/^הוסף: ענבים/, usual);
  assert.equal(await plus.getAttribute('aria-pressed'), 'true'); // back on the list, marked as added
  assert.equal(await amount(), String(Number(last) * 2)); // showing the amount just added
  await plus.tap(); // a second tap takes it back out
  await page.waitForFunction(() => document.querySelector('[aria-label^="הוסף: ענבים"]')?.getAttribute('aria-pressed') === 'false');
  await button('סיום', dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
  assert.equal(await entries('ארוחת צהריים').count(), 0);
});

test('water: a glass at a time on its own line, not under a meal', async () => {
  const water = page.getByRole('group', { name: 'מים' });
  const amount = () => water.getByRole('status').innerText();
  assert.match(await amount(), /^0 \/ 2 ליטר$/);
  assert.ok(await button('פחות כוס מים', water).isDisabled()); // nothing to take back yet
  await button('עוד כוס מים', water).tap();
  await button('עוד כוס מים', water).tap();
  await water.getByRole('status').filter({ hasText: /^0\.5 \// }).waitFor();
  assert.equal(await entries('ארוחת צהריים').count(), 0); // logged at lunchtime, but not listed as lunch food
  await button('פחות כוס מים', water).tap();
  await water.getByRole('status').filter({ hasText: /^0\.25 \// }).waitFor();
  await button('פחות כוס מים', water).tap();
  await water.getByRole('status').filter({ hasText: /^0 \// }).waitFor();
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

test('the foods tab: search first, then my foods and saved meals; the database only through search', async () => {
  await button(/מזונות/).tap();
  const mine = page.getByRole('region', { name: /^המזונות שלי/ });
  assert.ok(await mine.getByText('מזונות שתוסיפו או תערכו יופיעו כאן.').isVisible());
  assert.ok(await page.getByRole('region', { name: /^ארוחות שמורות/ }).getByText('ערב קבוע').isVisible());
  // a food of my own shows under "המזונות שלי", and is marked "שלי" in search
  await button('מזון חדש', mine).tap();
  await dialog().getByRole('textbox', { name: 'שם' }).fill('מסטיק בדיקה');
  await button(/מלא אפסים/, dialog()).tap();
  await button('שמור', dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
  await mine.getByRole('button', { name: 'הוסף ליומן: מסטיק בדיקה' }).waitFor();
  const grapes = page.getByRole('button', { name: /^הוסף ליומן: ענבים/ });
  assert.equal(await grapes.count(), 0); // the database stays closed until a search
  const search = page.getByRole('searchbox', { name: 'חיפוש במאגר' });
  await search.fill('ענבים');
  await grapes.first().waitFor();
  assert.equal(await page.getByRole('region', { name: /^המזונות שלי/ }).count(), 0); // while searching, only results
  await search.fill('מסטיק בדיקה');
  assert.ok(await page.getByText('שלי', { exact: true }).first().isVisible());
  // rows show just the name; tapping it opens the values and the edit buttons
  const edit = button('עריכה: מסטיק בדיקה');
  assert.ok(!(await edit.isVisible()));
  await page.getByText('מסטיק בדיקה', { exact: true }).tap();
  await edit.waitFor();
  await search.fill('');
  // one tap on a saved meal adds it to today, at the meal of the time of day (lunch); "בטל" takes it back
  const regular = page.getByRole('button', { name: 'הוסף ליומן: ערב קבוע' });
  await regular.tap();
  await page.getByRole('status').filter({ hasText: '״ערב קבוע״ נוסף לארוחת צהריים' }).waitFor();
  await regular.tap();
  await button('בטל', page.getByRole('status').filter({ hasText: 'ערב קבוע' })).tap();
  await button('יומן').tap();
  assert.equal(await entries('ארוחת צהריים').count(), 6); // added once, the second add undone
});

test('a supplement from its label: every vitamin per tablet, logged, and summed in the day', async () => {
  await openAdd();
  await button('מוצר ארוז או תוסף? צילום התווית', dialog()).tap();
  // test mode reads any photo as a multivitamin's label: no weight printed, so the values are per tablet
  await dialog().getByLabel('טבלה מהגלריה').setInputFiles({ name: 'label.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(await sampleJpeg(), 'base64') });
  await dialog().getByRole('status').filter({ hasText: 'הערכים מולאו מהתמונה, לטבליה אחת' }).waitFor();
  assert.equal(await dialog().getByRole('spinbutton', { name: 'ויטמין D (מק״ג)' }).inputValue(), '25');
  assert.equal(await dialog().getByRole('spinbutton', { name: 'ברזל (מ״ג)' }).inputValue(), '14');
  // one the label missed can be added by hand
  await dialog().getByRole('combobox', { name: 'ויטמין או מינרל נוסף' }).selectOption('מגנזיום (מ״ג)');
  await dialog().getByRole('spinbutton', { name: 'מגנזיום (מ״ג)' }).fill('50');
  await button('שמור', dialog()).tap();
  // then straight to the amount, 2 tablets: calories and macros only, no vitamins while adding
  await dialog().getByRole('spinbutton').first().fill('2');
  assert.doesNotMatch(await dialog().innerText(), /ויטמין D/);
  await button('הוסף לארוחת צהריים', dialog()).tap();
  await button(/^סיום/, dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
  // the day's vitamins are folded away until asked for
  const vitamins = page.getByRole('group', { name: 'ויטמינים ומינרלים היום' });
  assert.doesNotMatch(await vitamins.innerText(), /ויטמין D/);
  await vitamins.getByText('ויטמינים ומינרלים היום').tap();
  assert.match(await vitamins.innerText(), /ויטמין D 50 מק״ג[\s\S]*ויטמין C 160 מ״ג[\s\S]*ברזל 28 מ״ג[\s\S]*מגנזיום 100 מ״ג[\s\S]*אבץ 20 מ״ג/);
  // and a food's own, per tablet, when it is opened in the foods tab
  await button(/מזונות/).tap();
  const mine = page.getByRole('region', { name: /^המזונות שלי/ });
  await mine.getByText('מולטי ויטמין').tap();
  await mine.getByText('ויטמין D 25 מק״ג').waitFor();
  await button('יומן').tap();
});


test('settings show the goals first; tailoring is a few steps; a weigh-in in reports only logs', async () => {
  const spin = (name, scope = page) => scope.getByRole('spinbutton', { name });
  const goals = page.getByRole('region', { name: 'היעדים שלך' });
  const weighIn = async (kg, cm) => {
    await button(/דוחות/).tap();
    await spin('משקל היום (ק״ג)').fill(kg);
    await spin(/^מותניים/).fill(cm);
    await button('שמור שקילה').tap();
    await page.getByRole('status').filter({ hasText: 'השקילה נשמרה' }).waitFor();
  };
  const next = () => button('הבא', dialog());
  // a week ago: a weigh-in in Reports, then from the diary's hint to Settings
  await page.clock.setFixedTime(new Date('2026-10-14T09:00:00'));
  await weighIn('76', '90');
  await button('יומן').tap();
  await button('התאמה אישית').tap();
  assert.match(await goals.innerText(), /2000 קק״ל · חלבון 50 ג׳[\s\S]*כלליים/);
  // manual editing warns when the macros don't add up to the calories
  await button('עריכה ידנית', goals).tap();
  await spin('שומן (ג׳)', goals).fill('10');
  assert.ok(await goals.getByText(/^הפחמימות, השומן והחלבון שווים יחד \d+ קק״ל, לא 2000/).isVisible());
  await button('ביטול', goals).tap();
  // tailoring, step by step: what's missing is named; the weight comes from the last weigh-in
  await button('התאמה אישית', goals).tap();
  assert.equal(await spin('משקל (ק״ג)', dialog()).inputValue(), '76');
  assert.ok(await next().isDisabled());
  await spin('גיל', dialog()).fill('45');
  await spin('גובה (ס״מ)', dialog()).fill('165');
  await next().tap();
  await next().tap();
  await dialog().getByRole('radio', { name: 'דל פחמימות: עד 130 ג׳' }).check();
  await next().tap();
  assert.ok(await dialog().getByText(/^1.8 ג׳ × 68.1 ק״ג \(לא 76/).isVisible()); // the protein arithmetic, in her numbers
  await button('השתמש ביעדים האלה', dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
  await page.getByRole('status').filter({ hasText: 'היעדים עודכנו' }).waitFor();
  assert.match(await goals.innerText(), /חלבון 123 ג׳ · פחמימות 130 ג׳[\s\S]*מותאמים/);
  const kcal = async () => Number((await goals.innerText()).match(/(\d+) קק״ל/)[1]);
  const kcalBefore = await kcal();
  // today: a new weigh-in alone keeps the goals; tailoring again follows the new weight
  await page.clock.setFixedTime(new Date('2026-10-21T13:00:00'));
  await weighIn('75', '88');
  await button(/הגדרות/).tap();
  assert.equal(await kcal(), kcalBefore);
  await button('עדכון ההתאמה האישית', goals).tap();
  assert.equal(await spin('משקל (ק״ג)', dialog()).inputValue(), '75');
  for (let i = 0; i < 3; i++) await next().tap();
  await button('השתמש ביעדים האלה', dialog()).tap();
  await dialog().waitFor({ state: 'detached' });
  assert.ok(await kcal() < kcalBefore);
  await button(/דוחות/).tap();
  await button('חודש').tap();
  await page.getByRole('img', { name: /^משקל: מ־76 ק״ג .* ל־75 ק״ג/ }).waitFor();
  await page.getByRole('img', { name: /^מותניים: מ־90 ס״מ .* ל־88 ס״מ/ }).waitFor();
  await button('יומן').tap();
  const summary = page.getByRole('region', { name: 'סיכום היום' });
  assert.match(await summary.innerText(), /\/ לפחות 123 ג׳[\s\S]*\/ עד 130 ג׳/);
  assert.equal(await summary.getByText(/^יעדים כלליים/).count(), 0);
});


