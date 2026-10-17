// Search ranking and the meal parser against the real MoH database. Run: npm test (plain Node, no packages).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Food } from './db';
import { GRAMS, isFFQ, matchFoods, parseLine, searchFoods, splitAnd, unitFor } from './search.ts';

const moh: Food[] = JSON.parse(readFileSync(new URL('../public/foods/moh.json', import.meta.url), 'utf8'));
const first = (q: string, foods = moh, recent: string[] = []) => searchFoods(foods, q, recent)[0]?.name ?? '';
const own = (id: string, name: string, extra: Partial<Food> = {}): Food => ({ id, name, servingG: 100, kcal: 0, carbs: 0, fat: 0, protein: 0, ...extra });

test('plain foods come before processed ones', () => {
  assert.match(first('ענבים'), /^ענבים.*טרי/); // not juice or syrup
  assert.match(first('ביצה'), /^ביצה שלמה/); // a hen's egg, not a turkey's
  assert.match(first('תפוח'), /^תפוח עץ/);
  // dried, baked and powdered forms stay out of the top two unless typed
  for (const q of ['אגס', 'משמש', 'אננס', 'ביצה']) {
    const top = searchFoods(moh, q, []).slice(0, 2).map((f) => f.name);
    assert.ok(!top.some((n) => /מיובש|אפוי/.test(n)), `${q}: ${top.join(' | ')}`);
  }
  assert.match(first('אננס מיובש'), /מיובש/);
});

test('a meat finds the meat, not a dish, an organ or its fat', () => {
  assert.match(first('עוף'), /^בשר עוף,/); // was "פאי עוף", then "שומן עוף"
  assert.match(first('בקר'), /^בשר בקר,/);
  assert.match(first('חזה עוף'), /^בשר עוף, חזה, ללא עצם, מבושל/); // not stuffed or in sauce
  assert.match(first('כבד עוף'), /כבד/); // typed, so found
});

test('a Hebrew plural finds the singular', () => {
  assert.match(first('ביצים'), /^ביצה/);
  assert.match(first('עגבניות'), /^עגבניה/);
});

test('FFQ averages come last', () => {
  const hits = searchFoods(moh, 'ענבים', []);
  assert.ok(hits.some(isFFQ));
  assert.ok(isFFQ(hits.at(-1)!));
});

test('recent and own foods come first, hidden ones never', () => {
  const grapes = searchFoods(moh, 'ענבים', []);
  assert.equal(first('ענבים', moh, [grapes[3].id]), grapes[3].name);
  const mine = own('mine', 'ענבים מהשוק');
  assert.equal(first('ענבים', [...moh, mine]), mine.name);
  assert.notEqual(first('ענבים', moh.map((f) => (f.id === grapes[0].id ? { ...f, hidden: true } : f))), grapes[0].name);
});

test('an empty search lists recent foods, newest first', () => {
  const ids = [moh[5].id, moh[1].id];
  assert.deepEqual(searchFoods(moh, '', ids).map((f) => f.id), ids);
});

test('a typed meal splits into items with amounts', () => {
  assert.deepEqual(parseLine('יוגורט 150 גרם, 10 ענבים, כף חמאת בוטנים').map(({ query, qty, unit }) => [query, qty, unit]), [
    ['יוגורט', 150, GRAMS],
    ['ענבים', 10, null],
    ['חמאת בוטנים', null, 'כף'],
  ]);
});

test('meal parser: words, "and", sizes and joined numbers', () => {
  const items = (t: string) => parseLine(t).map(({ query, qty, unit }) => [query, qty, unit]);
  assert.deepEqual(items('חצי כוס אורז וכפית שמן'), [['אורז', 0.5, 'כוס'], ['שמן', null, 'כפית']]);
  assert.deepEqual(items('יוגורט 150 גרם 10 ענבים'), [['יוגורט', 150, GRAMS], ['ענבים', 10, null]]);
  assert.deepEqual(items('ענבים 150'), [['ענבים', 150, null]]);
  assert.deepEqual(items('150גרם יוגורט'), [['יוגורט', 150, GRAMS]]);
  assert.deepEqual(items('שתי פרוסות לחם'), [['לחם', 2, 'פרוסה']]);
  assert.deepEqual(items('כף גדושה סוכר'), [['סוכר', null, 'כף גדושה']]);
  assert.deepEqual(items('לחם עם חמאה'), [['לחם', null, null], ['חמאה', null, null]]);
});

test('unitFor: bare numbers, named units and fallbacks', () => {
  const grapes = searchFoods(moh, 'ענבים', [])[0];
  assert.deepEqual(unitFor(grapes, { qty: 150, unit: null }), { qty: 150, unit: { n: GRAMS, g: 1 } }); // 20+ means grams
  assert.equal(unitFor(grapes, { qty: 2, unit: null }).unit.n, 'יחידה בינונית'); // small means pieces, medium by default
  assert.deepEqual(unitFor(grapes, { qty: 1, unit: 'כף' }).unit, { n: 'כף', g: 15 }); // no such unit: typical weight
  assert.equal(unitFor(grapes, { qty: null, unit: GRAMS }).qty, grapes.servingG);
});

test('a leading "ו" is dropped when nothing matches, and "X וY" splits in two', () => {
  assert.match(matchFoods(moh, 'וגרנולה', [])[0].name, /גרנולה/);
  assert.deepEqual(splitAnd(moh, parseLine('קפה וגרנולה'), []).map((p) => p.query), ['קפה', 'גרנולה']);
});
