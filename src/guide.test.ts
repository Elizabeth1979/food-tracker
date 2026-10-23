// The guide's articles and the small Markdown reader behind them. Run: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { inline, parseArticle } from './guide.ts';

const dir = new URL('./articles/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

test('inline: bold and links, the rest plain text', () => {
  assert.deepEqual(inline('יש **שומן** ו[מקור](https://example.org/a) כאן'), [
    { text: 'יש ' }, { text: 'שומן', bold: true }, { text: ' ו' }, { text: 'מקור', href: 'https://example.org/a' }, { text: ' כאן' },
  ]);
  assert.deepEqual(inline('[לא בטוח](http://example.org)'), [{ text: '[לא בטוח](http://example.org)' }]); // https only
});

test('an article: title, headings, paragraphs, list items grouped in one list', () => {
  const a = parseArticle('x', '# כותרת\n\nפתיח\nבשתי שורות.\n\n## חלק\n- א\n- ב\n\nסוף');
  assert.equal(a.title, 'כותרת');
  assert.equal(a.lede, 'פתיח בשתי שורות.');
  assert.deepEqual(a.blocks.map((b) => b.kind), ['p', 'h', 'ul', 'p']);
});

// The owner's rules for every article: short, with headings, not medical advice, ending in linked sources.
for (const f of files) {
  test(`article ${f}: a 2-minute read with headings, a not-medical-advice line, and linked sources last`, () => {
    const a = parseArticle(f, readFileSync(new URL(f, dir), 'utf8'));
    const heads = a.blocks.filter((b) => b.kind === 'h').map((b) => b.kind === 'h' && b.parts.map((p) => p.text).join(''));
    assert.ok(heads.length >= 3, 'headings');
    assert.equal(heads.at(-1), 'מקורות');
    const last = a.blocks.at(-1)!;
    assert.equal(last.kind, 'ul');
    const links = last.kind === 'ul' ? last.items.flat().filter((p) => p.href) : [];
    assert.ok(links.length >= 2, 'at least two linked sources');
    assert.ok(a.blocks.some((b) => b.kind === 'p' && b.parts.some((p) => p.text.includes('לא ייעוץ רפואי'))));
    assert.ok(a.minutes <= 3, `${a.minutes} minutes`);
    assert.ok(a.lede.length <= 160, 'the opening line fits the list');
  });
}
