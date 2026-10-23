import type { IconName } from './icons';
import { client, hasPending, listEntries, supabase, syncPending, type Food, type Weight } from './db';
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
// Vitamins and minerals beyond the four columns above, mostly from supplement labels: { "ויטמין D (מק״ג)": 25, … }.
// The label reader is given these names, so one nutrient adds up across foods; anything else keeps its printed name and unit.
export const VITAMINS = [
  'ויטמין A (מק״ג)', 'ויטמין D (מק״ג)', 'ויטמין E (מ״ג)', 'ויטמין K (מק״ג)', 'ויטמין C (מ״ג)',
  'ויטמין B1 (מ״ג)', 'ויטמין B2 (מ״ג)', 'ויטמין B3 (מ״ג)', 'ויטמין B5 (מ״ג)', 'ויטמין B6 (מ״ג)', 'ביוטין (מק״ג)', 'חומצה פולית (מק״ג)',
  'ברזל (מ״ג)', 'מגנזיום (מ״ג)', 'אבץ (מ״ג)', 'סלניום (מק״ג)', 'יוד (מק״ג)', 'נחושת (מ״ג)', 'מנגן (מ״ג)', 'כרום (מק״ג)', 'מוליבדן (מק״ג)',
  'זרחן (מ״ג)', 'כולין (מ״ג)', 'אומגה 3 (מ״ג)',
];
export type Extra = Record<string, number>;
export type Nut = { kcal: number; carbs: number; fat: number; protein: number; extra?: Extra | null } & Partial<Record<MicroKey, number | null>>;
export type Item = Nut & { foodId?: string | null; name: string; grams: number; qty?: number | null; unit?: string | null };

// Water is logged as ordinary 0-kcal entries, a glass at a time, so it syncs, backs up and undoes like any food.
// The diary counts the plain waters of the MoH database (also when found by search) on their own line, not under a meal.
export const WATER: Item = { foodId: 'moh-9593', name: 'מים', grams: 250, qty: 1, unit: 'כוס', kcal: 0, carbs: 0, fat: 0, protein: 0 };
export const WATER_GOAL_ML = 2000;
const WATERS = new Set(['moh-9593', 'moh-4949', 'moh-10140', 'moh-4950', 'moh-4951', 'moh-4842']);
export const isWater = (e: { foodId?: string | null }) => WATERS.has(e.foodId ?? '');

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
const r2 = (x: number) => round(x, 2);
const scaleExtra = (x: Extra | null | undefined, f: number) => (x ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, r2(v * f)])) : x);
const addExtra = (a: Extra | null | undefined, b: Extra | null | undefined) => {
  if (!b) return a;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = r2((out[k] ?? 0) + v);
  return out;
};
export const scale = (n: Nut, f: number): Nut => ({
  kcal: Math.round(n.kcal * f), carbs: r1(n.carbs * f), fat: r1(n.fat * f), protein: r1(n.protein * f),
  ...Object.fromEntries(MICROS.map((m) => [m.key, n[m.key] == null ? null : round(n[m.key]! * f, m.dp)])),
  extra: scaleExtra(n.extra, f),
});
export const sum = (xs: Nut[]): Nut =>
  xs.reduce<Nut>((a, x) => ({
    kcal: a.kcal + x.kcal, carbs: r1(a.carbs + x.carbs), fat: r1(a.fat + x.fat), protein: r1(a.protein + x.protein),
    ...Object.fromEntries(MICROS.map((m) => [m.key, round((a[m.key] ?? 0) + (x[m.key] ?? 0), m.dp)])),
    extra: addExtra(a.extra, x.extra),
  }), { kcal: 0, carbs: 0, fat: 0, protein: 0, ...Object.fromEntries(MICROS.map((m) => [m.key, 0])) });
// the fields an Entry / saved-meal item carries (strips ids, dates, owner…)
export const pickItem = (e: Item): Item => {
  const { foodId, name, grams, qty, unit, kcal, carbs, fat, protein } = e;
  return { foodId, name, grams, qty, unit, kcal, carbs, fat, protein, ...Object.fromEntries(MICROS.map((m) => [m.key, e[m.key] ?? null])), extra: e.extra ?? null };
};
// The extras for display, in VITAMINS order then the rest: "ויטמין D 25 מק״ג".
export const extraParts = (x: Extra | null | undefined) => Object.entries(x ?? {})
  .filter(([, v]) => v)
  .sort(([a], [b]) => ((VITAMINS.indexOf(a) + 1 || 99) - (VITAMINS.indexOf(b) + 1 || 99)))
  .map(([k, v]) => { const [, name, unit] = k.match(/^(.*?)\s*\((.+)\)$/) ?? [, k, '']; return `${name} ${v}${unit ? ` ${unit}` : ''}`; });
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
async function shrunk(file: File, max: number) {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
const shrink = async (file: File, max = 1024) => (await shrunk(file, max)).toDataURL('image/jpeg', 0.8).split(',')[1];
export async function readPhoto(file: File, note: string): Promise<Parsed[]> {
  const { data, error } = await supabase.functions.invoke<{ items?: { name: string; qty: number; unit: string; grams?: number; hidden?: boolean }[]; error?: string }>('meal-photo', { body: { image: await shrink(file), note } });
  if (error || !data?.items) throw new Error(data?.error ?? 'זיהוי התמונה לא זמין כרגע. אפשר לכתוב את הארוחה במקום.');
  return data.items.map((i) => ({ text: `${i.name}, ${i.qty} ${i.unit}`, query: i.name, qty: i.qty, unit: i.unit, grams: i.grams, hidden: i.hidden }));
}
// Reads a nutrition table (טבלת ערכים תזונתיים) into per-100 g values for the new-food form. The one exception to
// "calories come from the database": a packaged product the database lacks, checked by the user before saving.
// A supplement label that gives no weight comes back per piece instead (basisG 1, unit "טבליה" = 1 g).
// Labels have small print, so the photo is kept larger than for a meal.
export type Label = Nut & { name: string; unit: Unit | null; perServing: boolean; basisG: number };
export async function readLabel(file: File): Promise<Label> {
  const { data, error } = await supabase.functions.invoke<{ label?: Label; error?: string }>('meal-photo', { body: { image: await shrink(file, 1568), mode: 'label', names: VITAMINS } });
  if (error || !data?.label) throw new Error(data?.error ?? 'קריאת הטבלה לא זמינה כרגע. אפשר למלא את הערכים ידנית.');
  return data.label;
}

// ---------- meal photos ----------
// A meal photo is kept so the diary can show it: in the private Storage bucket meal-photos, at
// <user>/<date>/<meal>.<id>.jpg (Storage policies allow only the user's own folder). The path says where it
// belongs, so there is no table. Photos need a connection: offline, saving fails and the diary shows none.
export type MealPhoto = { path: string; meal: MealKey; url: string };
const photos = () => supabase.storage.from('meal-photos');
const userId = async () => (await supabase.auth.getSession()).data.session!.user.id;
async function signed(paths: string[]): Promise<MealPhoto[]> {
  const { data, error } = await photos().createSignedUrls(paths, 3600);
  if (error) throw error;
  return data.flatMap((d) => (d.path && d.signedUrl ? [{ path: d.path, meal: d.path.split('/')[2].split('.')[0] as MealKey, url: d.signedUrl }] : []));
}
export async function savePhoto(file: File, date: string, meal: MealKey): Promise<MealPhoto> {
  const c = await shrunk(file, 1024);
  const jpeg = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', 0.8));
  const path = `${await userId()}/${date}/${meal}.${crypto.randomUUID()}.jpg`;
  const { error } = await photos().upload(path, jpeg, { contentType: 'image/jpeg' });
  if (error) throw error;
  return (await signed([path]))[0];
}
// The names one level down in a folder (files, or the day folders), oldest first; Storage pages its lists.
async function names(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await photos().list(dir, { limit: 1000, offset, sortBy: { column: 'created_at', order: 'asc' } });
    if (error) throw error;
    out.push(...data.map((f) => f.name));
    if (data.length < 1000) return out;
  }
}
export async function listPhotos(date: string): Promise<MealPhoto[]> {
  if (!navigator.onLine) return [];
  const dir = `${await userId()}/${date}`;
  const files = await names(dir);
  return files.length ? signed(files.map((f) => `${dir}/${f}`)) : [];
}
// To another meal of the same day: only the file name's meal changes.
export async function movePhoto(p: MealPhoto, meal: MealKey): Promise<MealPhoto> {
  const to = p.path.replace(/\/[^/.]+\.([^/]+)$/, `/${meal}.$1`);
  const { error } = await photos().move(p.path, to);
  if (error) throw error;
  return (await signed([to]))[0];
}
export async function deletePhoto(p: MealPhoto) {
  const { error } = await photos().remove([p.path]);
  if (error) throw error;
}

// Backups carry the photos as base64 JPEGs, each by its path inside the user's folder (<date>/<meal>.<id>.jpg).
export type PhotoFile = { path: string; jpeg: string };
const toBase64 = (b: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok((r.result as string).split(',')[1]);
  r.onerror = () => fail(r.error);
  r.readAsDataURL(b);
});
export async function exportPhotos(): Promise<PhotoFile[]> {
  const me = await userId();
  const paths = (await Promise.all((await names(me)).map(async (day) => (await names(`${me}/${day}`)).map((f) => `${day}/${f}`)))).flat();
  return Promise.all(paths.map(async (path) => {
    const { data, error } = await photos().download(`${me}/${path}`);
    if (error) throw error;
    return { path, jpeg: await toBase64(data) };
  }));
}
// Puts the backup's photos back in the user's folder; photos already there stay.
export async function restorePhotos(files: PhotoFile[]) {
  const me = await userId();
  for (const { path, jpeg } of files) {
    const body = new Blob([Uint8Array.from(atob(jpeg), (c) => c.charCodeAt(0))], { type: 'image/jpeg' });
    const { error } = await photos().upload(`${me}/${path}`, body, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
  }
}

// One weigh-in a day: a second one that day replaces it. Returns the new list, oldest first.
export async function saveWeight(weights: Weight[], kg: number, waist: number | null): Promise<Weight[]> {
  const row = { id: weights.find((w) => w.date === today())?.id, date: today(), kg, waist };
  const { data } = row.id ? await client.models.Weight.update(row as Weight) : await client.models.Weight.create(row);
  return [...weights.filter((w) => w.id !== data.id), data].sort((a, b) => a.date.localeCompare(b.date));
}
