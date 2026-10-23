// Test mode (`npm run dev:test`): stands in for db.ts so the app runs with no sign-in and no Supabase.
// Data lives in this browser's localStorage under one key. Vite swaps it in for './db' only in `--mode demo`
// (vite.config.ts), so it never ships in a build.
import type { Backup, Entry, Food, Profile, SavedMeal, TableName, Weight } from './db';

export type { Backup, BodyInfo, Entry, Food, Profile, SavedMeal, TableName, Weight } from './db';
export const TABLES: TableName[] = ['Food', 'Entry', 'SavedMeal', 'Profile', 'Weight'];

type Row = Record<string, unknown> & { id: string };
const KEY = 'food-tracker-test-data';
const load = (): Record<TableName, Row[]> => {
  const empty = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Record<TableName, Row[]>;
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; }
  catch { return empty; }
};
let db = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
// Same as the real layer: units / items may arrive as JSON strings.
const clean = (r: object): Row => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (k === 'units' || k === 'items') && typeof v === 'string' ? JSON.parse(v) : v])) as Row;

function model<T>(t: TableName) {
  const create = async (input: object) => {
    const row = { ...clean(input), id: (input as Row).id ?? (t === 'Profile' ? 'test-user' : crypto.randomUUID()) };
    db[t].push(row); save();
    return { data: row as unknown as T };
  };
  return {
    list: async () => ({ data: [...db[t]] as unknown as T[] }), // a copy, like the real layer: callers add to their own list
    create,
    update: async (input: object) => {
      const r = clean(input), i = db[t].findIndex((x) => x.id === r.id);
      if (i < 0) return create(r);
      db[t][i] = { ...db[t][i], ...r }; save();
      return { data: db[t][i] as unknown as T };
    },
    delete: async ({ id }: { id: string }) => { db[t] = db[t].filter((x) => x.id !== id); save(); return { data: null }; },
  };
}

export const client = {
  models: { Food: model<Food>('Food'), Entry: model<Entry>('Entry'), SavedMeal: model<SavedMeal>('SavedMeal'), Profile: model<Profile>('Profile'), Weight: model<Weight>('Weight') },
};
export const listEntries = async (from: string, to: string) => (db.Entry as unknown as Entry[]).filter((e) => e.date >= from && e.date <= to);
export const exportAll = async (): Promise<Backup> => structuredClone(db) as unknown as Backup;
export async function restoreAll(b: unknown) { db = { ...load(), ...(b as object) }; save(); }
// Everything is local here, so there is never anything waiting to be sent.
export const setOfflineUser = (_id: string) => {};
export const syncPending = async () => {};
export const hasPending = () => false;

// A signed-in "test user", and a photo reader that answers with a fixed sample instead of calling Claude:
// a meal, or for `mode: 'label'` a granola bar's nutrition table (per 100 g, with a 30 g bar as the serving).
const session = { user: { id: 'test-user', email: 'מצב בדיקה' } };
// Meal photos stay in memory for this page only: path → blob URL.
const files = new Map<string, string>();
const bucket = {
  upload: async (path: string, blob: Blob) => { files.set(path, URL.createObjectURL(blob)); return { error: null }; },
  list: async (dir: string) => ({ data: [...files.keys()].filter((p) => p.startsWith(dir + '/')).map((p) => ({ name: p.slice(dir.length + 1) })), error: null }),
  createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: files.get(path) ?? null })), error: null }),
  remove: async (paths: string[]) => { paths.forEach((p) => files.delete(p)); return { error: null }; },
};
export const supabase = {
  storage: { from: (_bucket: string) => bucket },
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOtp: async () => ({ error: null }),
    signOut: async () => { if (confirm('למחוק את כל נתוני הבדיקה?')) { localStorage.removeItem(KEY); location.reload(); } },
  },
  functions: {
    invoke: async <D,>(_name: string, opts: { body?: { mode?: string } }): Promise<{ data: D; error: null }> => {
      await new Promise((r) => setTimeout(r, 800));
      if (opts.body?.mode === 'label')
        return {
          data: { label: { name: 'חטיף גרנולה שוקולד', kcal: 433, carbs: 63.3, fat: 16.7, protein: 6.7, sodium: 233, calcium: 50, potassium: null, b12: null, unit: { n: 'מנה', g: 30 }, perServing: false } } as D,
          error: null,
        };
      return {
        data: { items: [{ name: 'יוגורט', qty: 1, unit: 'גביע' }, { name: 'ענבים', qty: 10, unit: 'יחידה' }, { name: 'חמאת בוטנים', qty: 1, unit: 'כפית' }, { name: 'גרנולה', qty: 2, unit: 'כף' }] } as D,
        error: null,
      };
    },
  },
};
