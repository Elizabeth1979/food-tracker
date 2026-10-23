// Food search and free-text meal parsing. Pure functions (no data layer), so they run under plain Node too.
import type { Food } from './db';

export type Unit = { n: string; g: number };
export const GRAMS = 'גרם';
export const unitsOf = (f?: Food | null): Unit[] => [{ n: GRAMS, g: 1 }, ...json<Unit[]>(f?.units, [])];
// a.json() fields arrive as JSON strings
export const json = <T,>(x: unknown, d: T): T => (typeof x === 'string' ? JSON.parse(x) : (x as T) ?? d);

// ---------- search ----------
export const norm = (s: string) => s.toLowerCase().replace(/["'׳״`,.()\-]/g, ' ').replace(/\s+/g, ' ').trim();
// Food Frequency Questionnaire groups: averages over several foods ("grapes or raisins"), not real foods.
export const isFFQ = (f: { name: string }) => f.name.startsWith('FFQ');
// Forms people rarely mean unless they type the word: "ענבים" should find grapes before grape juice or grape-seed oil,
// and "ביצה" a hen's egg before a turkey's.
const PROCESSED = ['מיץ', 'שמן', 'סירופ', 'בסירופ', 'משומר', 'משומרים', 'משקה', 'אבקה', 'אבקת', 'ממרח', 'חטיף', 'עוגיות', 'מחית', 'רוטב', 'תרכיז',
  'מיובש', 'מיובשת', 'מיובשים', 'מוס', 'במילוי', 'ברוטב', 'מיונז', 'סוכר', 'מסוכר', 'ממותק', 'אפוי', 'מטוגן', 'מטוגנת', 'מטוגנים', 'צ יפס', 'בבלילה', 'חביתה', 'מתערובת', 'בגריל', 'צלוי', 'צלויה', 'פצפוצי'];
const RARE = ['אם', 'תינוקות', 'הודו', 'בופאלו', 'נאקות', 'גמלים', 'כבשים', 'עזים', 'אווז', 'ברווז', 'שליו',
  // organs, odd cuts and fast food: "עוף" means the meat, not its liver, feet or a McDonald's item
  'לב', 'לבבות', 'כבד', 'טחול', 'קורקבן', 'קורקבנים', 'כליות', 'לשון', 'מוח', 'קיבה', 'גב', 'צוואר', 'עצמות', 'רגליים',
  'מקדונלדס', 'גלוטן', 'הצומח']; // gluten-free and plant-based ("מן הצומח") versions only when typed
// Words a photo or a person uses that the database names otherwise: mashed potato is "פירה".
const SAME: Record<string, string> = { מעוך: 'פירה', מעוכים: 'פירה', מעוכה: 'פירה' };
const FRESH = ['טרי', 'טריה', 'טריים', 'טריות', 'רגיל'];
// Everyday staples whose plain entry loses on name length alone: "פיתה" means a regular pita, not a toasted one.
const STAPLES: Record<string, string> = { פיתה: 'moh-1946' };
// "ביצים" should find "ביצה", "עגבניות" "עגבניה": also accept a rough singular of Hebrew plurals.
const forms = (w: string) => (w.length < 5 ? [w] : w.endsWith('ים') ? [w, w.slice(0, -2)] : w.endsWith('ות') ? [w, w.slice(0, -2) + 'ה', w.slice(0, -2)] : [w]);
const sameWord = (a: string, w: string) => forms(w).some((x) => a === x || (x !== w && a.startsWith(x) && a.length <= x.length + 1));

export function searchFoods(foods: Food[], q: string, recent: string[]) {
  const words = norm(q).split(' ').filter(Boolean).map((w) => SAME[w] ?? w);
  const query = words.join(' ');
  const has = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);
  const rank = (f: Food) => {
    const name = norm(f.name);
    // "בשר עוף, חזה…" is chicken: a leading "בשר" (meat of) doesn't count, unless it was typed.
    const head = norm(f.name.split(',')[0]);
    const first = words[0] === 'בשר' ? head : head.replace(/^בשר /, '');
    // "אטריות/פסטה" is either word
    const firstWords = first.split(' ')[0].split('/');
    // "ללא תוספת שמן" (no added oil) isn't an oil dish
    const what = name.replace(/ללא( תוספת)? \S+/g, '');
    const r = recent.indexOf(f.id);
    let s = r >= 0 ? r - 1000 : 0;
    if (f.source === 'moh') s += 100; // your own foods first
    if (isFFQ(f)) s += 400;
    s += name === query ? 0 : first === query || firstWords.some((w) => sameWord(w, words[0] ?? '')) ? 10 : name.startsWith(query) ? 20 : name.startsWith(words[0] ?? '') ? 30 : 50;
    // a typed word found only inside another ("רום וקולה" for "קולה") is a weaker match
    if (!words.every((w) => forms(w).some((x) => name.split(/[ \/]/).some((t) => t.startsWith(x))))) s += 20;
    // "ושמן קנולה" (and canola oil) counts as oil too
    s += PROCESSED.filter((w) => !words.includes(w) && (has(what, w) || has(what, 'ו' + w))).length * 15;
    s += RARE.filter((w) => !words.includes(w) && has(name, w)).length * 20;
    if (has(name, 'לא מבושל') && !words.includes('מבושל')) s += 10;
    if ((has(first, 'עם') || has(first, 'או')) && !words.includes('עם')) s += 10; // mixed dishes: "אורז עם בצל"
    // fresh produce: exactly what was typed ("גזר, טרי") before a longer name that starts with it ("גזר לבן", parsnip)
    if (FRESH.some((w) => has(name, w))) s -= forms(query).includes(first) ? 4 : 3;
    if (forms(query).some((w) => STAPLES[w] === f.id)) s -= 15;
    return s + f.name.length / 100;
  };
  // With nothing typed the list is "recent": newest first, nothing else counts.
  if (!words.length) return recent.flatMap((id) => foods.find((f) => f.id === id && !f.hidden) ?? []).slice(0, 60);
  const hits = foods.filter((f) => { const t = norm(f.name + ' ' + (f.nameEn ?? '')); return words.every((w) => forms(w).some((x) => t.includes(x))); });
  return hits.filter((f) => !f.hidden).sort((a, b) => rank(a) - rank(b)).slice(0, 60);
}

// ---------- free text: "יוגורט 150 גרם, 10 ענבים, כף חמאת בוטנים" ----------
// grams: a photo's guess of the whole amount's weight, to check its unit against (see unitFor).
// hidden: a fat or sauce the photo inferred but can't show (frying oil, dressing), for the user to confirm.
export type Parsed = { text: string; query: string; qty: number | null; unit: string | null; grams?: number; hidden?: boolean };

const NUMBERS: Record<string, number> = {
  חצי: 0.5, רבע: 0.25, אחד: 1, אחת: 1, שני: 2, שתי: 2, שניים: 2, שתיים: 2, זוג: 2, שלוש: 3, שלושה: 3, כמה: 3,
  ארבע: 4, ארבעה: 4, חמש: 5, חמישה: 5, שש: 6, שישה: 6, שבע: 7, שבעה: 7, שמונה: 8, תשע: 9, תשעה: 9, עשר: 10, עשרה: 10,
};
// Unit words as people type them -> the unit name the food database uses. Plurals and abbreviations included.
const UNITS: Record<string, string> = {
  גרם: GRAMS, גר: GRAMS, ג: GRAMS, g: GRAMS, gr: GRAMS, גרמים: GRAMS, מל: GRAMS, ml: GRAMS,
  כף: 'כף', כפות: 'כף', כפית: 'כפית', כפיות: 'כפית', כוס: 'כוס', כוסות: 'כוס', ספל: 'ספל', ספלים: 'ספל',
  פרוסה: 'פרוסה', פרוסות: 'פרוסה', יחידה: 'יחידה', יחידות: 'יחידה', גביע: 'גביע', גביעים: 'גביע',
  מנה: 'מנה', מנות: 'מנה', חופן: 'חופן', חופנים: 'חופן', קערה: 'קערה', קערית: 'קערית', צלחת: 'צלחת', פלח: 'פלח', פלחים: 'פלח',
  ביס: 'ביס', ביסים: 'ביס', כדור: 'כדור', שקית: 'שקית', אריזה: 'אריזה', בקבוק: 'בקבוק', פחית: 'פחית', קופסה: 'קופסה',
};
// Typical weights for when a food has no unit of that name.
export const FALLBACK_G: Record<string, number> = { כף: 15, כפית: 5, כוס: 240, ספל: 250, פרוסה: 30, גביע: 150, מנה: 150, חופן: 30, קערה: 300, קערית: 150, צלחת: 300, ביס: 15 };

const SIZE = ['גדושה', 'שטוחה', 'גדולה', 'קטנה', 'בינונית'];
const num = (t: string) => (/^\d+(\.\d+)?$/.test(t) ? Number(t) : NUMBERS[t] ?? null);

// Splits on commas, new lines, "+" and "עם"; inside a piece, a new amount after a named food starts the next item
// ("חצי כוס אורז וכפית שמן" -> rice, oil). Amounts may come before or after the food ("ענבים 150").
export function parseLine(text: string): Parsed[] {
  const out: Parsed[] = [];
  for (const seg of text.split(/[,،;\n+]|\s+עם\s+/)) {
    // "150גרם" / "2כפות" -> "150 גרם"
    const tokens = norm(seg.replace(/(\d)([^\d\s.,%])/g, '$1 $2')).split(' ').filter(Boolean);
    let cur = { words: [] as string[], raw: [] as string[], qty: null as number | null, unit: null as string | null };
    const flush = () => {
      if (cur.unit && SIZE.includes(cur.words[0])) cur.unit = `${cur.unit} ${cur.words.shift()}`; // "כף גדושה"
      const query = cur.words.join(' ');
      if (query) out.push({ text: cur.raw.join(' '), query, qty: cur.qty, unit: cur.unit });
      cur = { words: [], raw: [], qty: null, unit: null };
    };
    for (const raw of tokens) {
      // "וכף" / "ו2" / "ושתי" -> a new amount joined by "and"
      const joined = /^ו\S/.test(raw) && (num(raw.slice(1)) != null || UNITS[raw.slice(1)] != null);
      const t = joined ? raw.slice(1) : raw;
      const n = num(t), u = UNITS[t];
      // a second amount after a named food belongs to the next item: "יוגורט 150 גרם 10 ענבים"
      if (cur.words.length && (n != null || u) && (joined || (n != null ? cur.qty != null || cur.unit != null : cur.unit != null))) flush();
      if (n != null && cur.qty == null && !cur.unit) cur.qty = n;
      else if (u && !cur.unit) cur.unit = u;
      else cur.words.push(raw);
      cur.raw.push(raw);
    }
    flush();
  }
  return out;
}

// Picks the food's unit for a parsed amount. A photo's weight guess overrules a unit far off it:
// "4 יחידה" of lettuce meant 4 leaves, not 4 heads of 648 g. Then the food's unit that fits that count is used, else grams.
export function unitFor(food: Food, p: Pick<Parsed, 'qty' | 'unit' | 'grams'>): { qty: number; unit: Unit } {
  const a = unitByName(food, p);
  const g = p.grams;
  if (!g || off(a.qty * a.unit.g, g) < OFF) return a;
  const best = unitsOf(food).slice(1).sort((x, y) => off(a.qty * x.g, g) - off(a.qty * y.g, g))[0];
  return best && off(a.qty * best.g, g) < OFF ? { qty: a.qty, unit: best } : { qty: Math.round(g), unit: unitsOf(food)[0] };
}
// How many times apart two weights are; under OFF counts as the same amount.
const off = (a: number, b: number) => Math.max(a, b) / Math.min(a, b);
const OFF = 1.6;

// Bare numbers: 20+ means grams, smaller means pieces.
function unitByName(food: Food, p: Pick<Parsed, 'qty' | 'unit'>): { qty: number; unit: Unit } {
  const units = unitsOf(food);
  const grams = units[0];
  const piece = ['יחידה בינונית', 'יחידה', 'פרוסה', 'פרוסה בינונית', 'גביע', 'מנה בינונית', 'מנה', 'ספל', 'כוס'].map((n) => units.find((u) => u.n === n)).find(Boolean);
  if (p.unit === GRAMS) return { qty: p.qty ?? food.servingG, unit: grams };
  if (p.unit) {
    // "יחידה" with no size means a medium one, not the first size listed (often "קטנה").
    const u = units.find((x) => x.n === p.unit) ?? units.find((x) => x.n === `${p.unit} בינונית`)
      ?? units.find((x) => x.n.startsWith(p.unit + ' ')) ?? units.find((x) => x.n.startsWith(p.unit!.split(' ')[0]));
    if (u) return { qty: p.qty ?? 1, unit: u };
    const g = FALLBACK_G[p.unit.split(' ')[0]];
    if (g) return { qty: p.qty ?? 1, unit: { n: p.unit, g } };
  }
  if (p.qty != null && (p.qty >= 20 || !piece)) return { qty: p.qty, unit: grams };
  if (piece) return { qty: p.qty ?? 1, unit: piece };
  return { qty: food.servingG, unit: grams };
}

// Best matches for a typed name; retries without a leading "ו" ("וגרנולה"), since names like "ויטמין" start with one.
// Is a typed word the food itself (in the name's first part), rather than one ingredient of a dish?
const inHead = (f: Food, words: string[]) => norm(f.name.split(',')[0]).split(/[ \/]/).some((t) => words.some((w) => sameWord(t, w)));
function matchExact(foods: Food[], query: string, recent: string[]) {
  const hits = searchFoods(foods, query, recent);
  if (!hits.length && /^ו\S{3}/.test(query)) return searchFoods(foods, query.slice(1), recent);
  // "גזר כבוש" has no pickled-carrot food, only dishes that list carrot among their ingredients (potato salad).
  // Then the plain food ("גזר") is the better guess; the dishes stay further down the list.
  const words = norm(query).split(' ');
  if (!hits.length || words.length < 2 || inHead(hits[0], words)) return hits;
  const plain = searchFoods(foods, words[0], recent).filter((f) => inHead(f, words.slice(0, 1)));
  return plain.length ? [...plain, ...hits.filter((f) => !plain.includes(f))] : hits;
}
// A word the database doesn't know ("תפוח אדמה מבושל בתנור") shouldn't leave the row unmatched: drop words from the end.
export function matchFoods(foods: Food[], query: string, recent: string[]): Food[] {
  const hits = matchExact(foods, query, recent);
  const words = norm(query).split(' ');
  return hits.length || words.length < 2 ? hits : matchFoods(foods, words.slice(0, -1).join(' '), recent);
}

// "קפה וגרנולה" matches nothing as one food: split it at the "ו" into two items. Only when the whole phrase has no match.
export function splitAnd(foods: Food[], items: Parsed[], recent: string[]): Parsed[] {
  return items.flatMap((p) => {
    if (matchExact(foods, p.query, recent).length) return [p];
    const words = p.query.split(' ');
    const i = words.findIndex((w, j) => j > 0 && /^ו\S{2}/.test(w));
    if (i < 0) return [p];
    const a = words.slice(0, i).join(' '), b = [words[i].slice(1), ...words.slice(i + 1)].join(' ');
    return [{ ...p, text: a, query: a }, ...splitAnd(foods, [{ text: b, query: b, qty: null, unit: null }], recent)];
  });
}
