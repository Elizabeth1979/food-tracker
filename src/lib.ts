import { client, type Food } from './db';

export { client };
export type { Food, Entry, SavedMeal, Profile } from './db';
export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Unit = { n: string; g: number };
export const MICROS = [
  { key: 'sodium', label: 'נתרן', unit: 'מ״ג', dp: 0 },
  { key: 'calcium', label: 'סידן', unit: 'מ״ג', dp: 0 },
  { key: 'potassium', label: 'אשלגן', unit: 'מ״ג', dp: 0 },
  { key: 'b12', label: 'B12', unit: 'מק״ג', dp: 2, rda: 2.4 },
] as const;
export type MicroKey = (typeof MICROS)[number]['key'];
export type Nut = { kcal: number; carbs: number; fat: number; protein: number } & Partial<Record<MicroKey, number | null>>;
export type Item = Nut & { foodId?: string | null; name: string; grams: number; qty?: number | null; unit?: string | null };

export const MEALS: { key: MealKey; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'ארוחת בוקר', icon: '🌅' },
  { key: 'lunch', label: 'ארוחת צהריים', icon: '☀️' },
  { key: 'dinner', label: 'ארוחת ערב', icon: '🌙' },
  { key: 'snack', label: 'נשנושים ואחר', icon: '🍎' },
];
export const MACROS = [
  { key: 'carbs', label: 'פחמימות', color: '#3f95d4', kcalPerG: 4 },
  { key: 'fat', label: 'שומן', color: '#b88a12', kcalPerG: 9 },
  { key: 'protein', label: 'חלבון', color: '#e0607e', kcalPerG: 4 },
] as const;
export const GRAMS = 'גרם';

// ---------- dates (local timezone) ----------
export const today = () => new Date().toLocaleDateString('en-CA');
export const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00');
  x.setDate(x.getDate() + n);
  return x.toLocaleDateString('en-CA');
};
export const fmtDate = (d: string, o: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(d + 'T12:00:00').toLocaleDateString('he-IL', o);
export const daysBetween = (a: string, b: string) => {
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
};

// ---------- nutrition math ----------
const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;
const r1 = (x: number) => round(x, 1);
export const scale = (n: Nut, f: number): Nut => ({
  kcal: Math.round(n.kcal * f), carbs: r1(n.carbs * f), fat: r1(n.fat * f), protein: r1(n.protein * f),
  ...Object.fromEntries(MICROS.map((m) => [m.key, n[m.key] == null ? null : round(n[m.key]! * f, m.dp)])),
});
export const sum = (xs: Nut[]): Nut =>
  xs.reduce<Nut>((a, x) => ({
    kcal: a.kcal + x.kcal, carbs: r1(a.carbs + x.carbs), fat: r1(a.fat + x.fat), protein: r1(a.protein + x.protein),
    ...Object.fromEntries(MICROS.map((m) => [m.key, round((a[m.key] ?? 0) + (x[m.key] ?? 0), m.dp)])),
  }), { kcal: 0, carbs: 0, fat: 0, protein: 0, ...Object.fromEntries(MICROS.map((m) => [m.key, 0])) });
// the fields an Entry / saved-meal item carries (strips ids, dates, owner…)
export const pickItem = (e: Item): Item => {
  const { foodId, name, grams, qty, unit, kcal, carbs, fat, protein } = e;
  return { foodId, name, grams, qty, unit, kcal, carbs, fat, protein, ...Object.fromEntries(MICROS.map((m) => [m.key, e[m.key] ?? null])) };
};
// a.json() fields arrive as JSON strings
export const json = <T,>(x: unknown, d: T): T => (typeof x === 'string' ? JSON.parse(x) : (x as T) ?? d);
export const unitsOf = (f?: Food | null): Unit[] => [{ n: GRAMS, g: 1 }, ...json<Unit[]>(f?.units, [])];
export const itemFor = (f: Food, qty: number, unit: Unit): Item => {
  const grams = r1(qty * unit.g);
  return { foodId: f.id, name: f.name, grams, qty, unit: unit.n, ...scale(f as Nut, grams / f.servingG) };
};
export const amountLabel = (e: { grams: number; qty?: number | null; unit?: string | null }) =>
  e.unit && e.unit !== GRAMS ? `${e.qty} ${e.unit} (${e.grams} ג׳)` : `${e.grams} ג׳`;

// ---------- data ----------
// The MoH (Tzameret) database is read from /foods/moh.json at runtime and never copied into the DB.
// Local Food rows override MoH rows with the same id (edits, `hidden`); other local rows are the user's own foods.
let moh: Promise<Food[]> | undefined;
const loadMoh = (): Promise<Food[]> =>
  (moh ??= fetch('/foods/moh.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`moh.json ${r.status}`)))).catch((e) => { moh = undefined; console.error(e); return []; }));

export async function loadFoods(): Promise<Food[]> {
  const [base, { data: local }] = await Promise.all([loadMoh(), client.models.Food.list()]);
  const own = new Map(local.map((f) => [f.id, f]));
  const merged = base.map((f) => (own.has(f.id) ? { ...f, ...own.get(f.id) } : f));
  const ids = new Set(base.map((f) => f.id));
  return [...merged, ...local.filter((f) => !ids.has(f.id) && f.name)];
}
export const loadSavedMeals = async () => (await client.models.SavedMeal.list()).data;
export const loadEntries = async (from: string, to: string) =>
  (await client.models.Entry.list()).data.filter((e) => e.date >= from && e.date <= to);

export const addEntries = (date: string, meal: MealKey, items: Item[]) =>
  Promise.all(items.map((it) => client.models.Entry.create({ ...it, date, meal }).then((r) => r.data)));

// ---------- search ----------
const norm = (s: string) => s.toLowerCase().replace(/["'׳״`,.()\-]/g, ' ');
export function searchFoods(foods: Food[], q: string, recent: string[]) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const rank = (f: Food) => {
    const r = recent.indexOf(f.id);
    return (r >= 0 ? r - 1000 : 0) + (f.source === 'moh' ? 100 : 0) + (norm(f.name).trimStart().startsWith(words[0] ?? '') ? 0 : 50) + f.name.length / 100;
  };
  const hits = words.length
    ? foods.filter((f) => { const t = norm(f.name + ' ' + (f.nameEn ?? '')); return words.every((w) => t.includes(w)); })
    : foods.filter((f) => recent.includes(f.id));
  return hits.filter((f) => !f.hidden).sort((a, b) => rank(a) - rank(b)).slice(0, 60);
}

export const store = {
  get<T>(k: string, d: T): T { try { return JSON.parse(localStorage.getItem(k) ?? '') ?? d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
export const pushRecent = (id: string) => store.set('recent', [id, ...store.get<string[]>('recent', []).filter((x) => x !== id)].slice(0, 40));
