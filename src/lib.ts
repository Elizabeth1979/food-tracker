import type { IconName } from './icons';
import { client, hasPending, listEntries, supabase, syncPending, type Food } from './db';
import { GRAMS, json, unitsOf, type Parsed, type Unit } from './search';

export { client, hasPending, syncPending };
export { GRAMS, json, unitsOf, searchFoods, matchFoods, parseLine, splitAnd, unitFor, isFFQ, type Unit, type Parsed } from './search';
export type { Food, Entry, SavedMeal, Profile, BodyInfo, Weight } from './db';
export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MICROS = [
  { key: 'sodium', label: 'נתרן', unit: 'מ״ג', dp: 0 },
  { key: 'calcium', label: 'סידן', unit: 'מ״ג', dp: 0 },
  { key: 'potassium', label: 'אשלגן', unit: 'מ״ג', dp: 0 },
  { key: 'b12', label: 'B12', unit: 'מק״ג', dp: 2, rda: 2.4 },
] as const;
export type MicroKey = (typeof MICROS)[number]['key'];
export type Nut = { kcal: number; carbs: number; fat: number; protein: number } & Partial<Record<MicroKey, number | null>>;
export type Item = Nut & { foodId?: string | null; name: string; grams: number; qty?: number | null; unit?: string | null };

export const MEALS: { key: MealKey; label: string; short: string; icon: IconName }[] = [
  { key: 'breakfast', label: 'ארוחת בוקר', short: 'בוקר', icon: 'sunrise' },
  { key: 'lunch', label: 'ארוחת צהריים', short: 'צהריים', icon: 'sun' },
  { key: 'dinner', label: 'ארוחת ערב', short: 'ערב', icon: 'moon' },
  { key: 'snack', label: 'נשנושים ואחר', short: 'נשנושים', icon: 'apple' },
];
export const MACROS = [
  { key: 'carbs', label: 'פחמימות', color: 'var(--carbs)', kcalPerG: 4 },
  { key: 'fat', label: 'שומן', color: 'var(--fat)', kcalPerG: 9 },
  { key: 'protein', label: 'חלבון', color: 'var(--protein)', kcalPerG: 4 },
] as const;

// ---------- dates (local timezone) ----------
export const today = () => new Date().toLocaleDateString('en-CA');
export const mealNow = (): MealKey => { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; };
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
export const loadMoh = (): Promise<Food[]> =>
  (moh ??= fetch('/foods/moh.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`moh.json ${r.status}`)))).catch((e) => { moh = undefined; console.error(e); return []; }));

export async function loadFoods(): Promise<Food[]> {
  const [base, { data: local }] = await Promise.all([loadMoh(), client.models.Food.list()]);
  const own = new Map(local.map((f) => [f.id, f]));
  const merged = base.map((f) => (own.has(f.id) ? { ...f, ...own.get(f.id) } : f));
  const ids = new Set(base.map((f) => f.id));
  return [...merged, ...local.filter((f) => !ids.has(f.id) && f.name)];
}
export const loadSavedMeals = async () => (await client.models.SavedMeal.list()).data;
export const loadEntries = listEntries;

// Adds a unit ("פרוסה" = 20 g) to a food. A MoH food gets its first local row this way, so the whole food is sent.
export async function addUnit(food: Food, unit: Unit): Promise<Food> {
  const units = [...json<Unit[]>(food.units, []).filter((u) => u.n !== unit.n), unit];
  const { data } = await client.models.Food.update({ ...food, units: JSON.stringify(units) });
  return { ...food, ...data, units };
}

export const addEntries = (date: string, meal: MealKey, items: Item[]) =>
  Promise.all(items.map((it) => client.models.Entry.create({ ...it, date, meal }).then((r) => r.data)));

export { store } from './store';

// ---------- photo ----------
// Shrinks the photo on the device (cost and upload time follow the pixel count, recognition doesn't need more),
// then asks the meal-photo Edge Function which foods it shows. The answer is the same shape typed text parses to.
async function shrink(file: File, max = 1024): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8).split(',')[1];
}
export async function readPhoto(file: File, note: string): Promise<Parsed[]> {
  const { data, error } = await supabase.functions.invoke<{ items?: { name: string; qty: number; unit: string }[]; error?: string }>('meal-photo', { body: { image: await shrink(file), note } });
  if (error || !data?.items) throw new Error(data?.error ?? 'זיהוי התמונה לא זמין כרגע. אפשר לכתוב את הארוחה במקום.');
  return data.items.map((i) => ({ text: `${i.name}, ${i.qty} ${i.unit}`, query: i.name, qty: i.qty, unit: i.unit }));
}
// Reads a nutrition table (טבלת ערכים תזונתיים) into per-100 g values for the new-food form. The one exception to
// "calories come from the database": a packaged product the database lacks, checked by the user before saving.
// Labels have small print, so the photo is kept larger than for a meal.
export type Label = Nut & { name: string; unit: Unit | null; perServing: boolean };
export async function readLabel(file: File): Promise<Label> {
  const { data, error } = await supabase.functions.invoke<{ label?: Label; error?: string }>('meal-photo', { body: { image: await shrink(file, 1568), mode: 'label' } });
  if (error || !data?.label) throw new Error(data?.error ?? 'קריאת הטבלה לא זמינה כרגע. אפשר למלא את הערכים ידנית.');
  return data.label;
}
