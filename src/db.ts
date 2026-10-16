// Supabase data store. Every row belongs to the signed-in user: RLS on each table allows only
// rows where user_id (profiles: id) = auth.uid(), and inserts default those columns to auth.uid().
// `client.models.X` keeps the small list/create/update/delete surface the app was written against.
import { createClient, type PostgrestError } from '@supabase/supabase-js';
import type { MealKey } from './lib';

type Micros = { sodium?: number | null; calcium?: number | null; potassium?: number | null; b12?: number | null };
type Nutrients = { kcal: number; carbs: number; fat: number; protein: number } & Micros;

// Nutrients are per `servingG` grams. units: [{ n: name, g: grams }] (array or JSON string)
export type Food = Nutrients & { id: string; name: string; nameEn?: string | null; source?: string | null; hidden?: boolean | null; servingG: number; units?: unknown };
// One logged item. Nutrients are totals for the logged amount (snapshot). date: YYYY-MM-DD local
export type Entry = Nutrients & { id: string; date: string; meal: MealKey; foodId?: string | null; name: string; grams: number; qty?: number | null; unit?: string | null };
// items: Item[] (older backups hold a JSON string)
export type SavedMeal = { id: string; name: string; items: unknown };
// One row per user; id is the user's id.
export type Profile = { id: string; kcal?: number | null; carbs?: number | null; fat?: number | null; protein?: number | null };

type Tables = { Food: Food; Entry: Entry; SavedMeal: SavedMeal; Profile: Profile };
export type TableName = keyof Tables;
export const TABLES: TableName[] = ['Food', 'Entry', 'SavedMeal', 'Profile'];
export type Backup = { [K in TableName]: Tables[K][] };
type Res<T> = { data: T; errors?: { message: string }[] };

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example)');
// Implicit flow: the magic link carries the session itself, so it works in whichever browser opens it.
export const supabase = createClient(url, key, { auth: { flowType: 'implicit' } });

const TABLE: Record<TableName, string> = { Food: 'foods', Entry: 'entries', SavedMeal: 'saved_meals', Profile: 'profiles' };
const NUTS = ['kcal', 'carbs', 'fat', 'protein', 'sodium', 'calcium', 'potassium', 'b12'];
// The columns the app writes. Rows from the UI or a backup can carry extras (user_id, created_at, Amplify's owner…).
const COLS: Record<TableName, string[]> = {
  Food: ['id', 'name', 'nameEn', 'source', 'hidden', 'servingG', 'units', ...NUTS],
  Entry: ['id', 'date', 'meal', 'foodId', 'name', 'grams', 'qty', 'unit', ...NUTS],
  SavedMeal: ['id', 'name', 'items'],
  Profile: ['id', 'kcal', 'carbs', 'fat', 'protein'],
};
const JSON_COLS = new Set(['units', 'items']);
// Foods are keyed per user, so a user can override a shipped MoH food under its own id.
const CONFLICT: Record<TableName, string> = { Food: 'user_id,id', Entry: 'id', SavedMeal: 'id', Profile: 'id' };
// Entries keep the order they were logged in; the rest sort by name.
const ORDER: Record<TableName, string> = { Food: 'name', Entry: 'created_at', SavedMeal: 'name', Profile: 'id' };

const clean = (t: TableName, row: object) => {
  const r = row as Record<string, unknown>;
  return Object.fromEntries(
    COLS[t].filter((c) => r[c] !== undefined).map((c) => [c, JSON_COLS.has(c) && typeof r[c] === 'string' ? JSON.parse(r[c] as string) : r[c]]),
  );
};

type Page<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
const PAGE = 1000; // PostgREST's default row cap per request
async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}
const listAll = <K extends TableName>(t: K) =>
  fetchAll<Tables[K]>((a, b) => supabase.from(TABLE[t]).select('*').order(ORDER[t]).order('id').range(a, b));

// Failures throw (the app shows them in its error banner) instead of handing callers a null row.
function model<K extends TableName>(t: K) {
  type T = Tables[K];
  const create = async (input: Omit<T, 'id'> & { id?: string }): Promise<Res<T>> => {
    const { data, error } = await supabase.from(TABLE[t]).insert(clean(t, input)).select().single();
    if (error) throw error;
    return { data: data as T };
  };
  return {
    list: async (): Promise<Res<T[]>> => ({ data: await listAll(t) }),
    create,
    // Updates the row, or creates it when there is none yet: that is how a MoH food gets its first
    // local override (an edit, or hidden: true), so callers pass the whole food in that case.
    update: async (input: Partial<T> & { id: string }): Promise<Res<T>> => {
      const { id, ...patch } = clean(t, input);
      const { data, error } = await supabase.from(TABLE[t]).update(patch).eq('id', input.id).select();
      if (error) throw error;
      return data.length ? { data: data[0] as T } : create(input as Omit<T, 'id'> & { id: string });
    },
    delete: async ({ id }: { id: string }): Promise<Res<null>> => {
      const { error } = await supabase.from(TABLE[t]).delete().eq('id', id);
      if (error) throw error;
      return { data: null };
    },
  };
}

export const client = {
  models: { Food: model('Food'), Entry: model('Entry'), SavedMeal: model('SavedMeal'), Profile: model('Profile') },
};

export const listEntries = (from: string, to: string) =>
  fetchAll<Entry>((a, b) => supabase.from('entries').select('*').gte('date', from).lte('date', to).order('created_at').order('id').range(a, b));

// Same shape as the local-only app's backups, so files move freely between the two.
export const exportAll = async (): Promise<Backup> =>
  Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await listAll(t)).map((r) => clean(t, r))]))) as Backup;

const chunks = <T,>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// Replaces all of the user's data with the backup. Throws on a file that isn't a backup, before touching anything.
// Upserts first and deletes leftovers last, so a failure part-way never loses rows that were in the backup.
// `moh` completes partial MoH overrides from local-only backups (e.g. just { id, hidden: true }).
export async function restoreAll(b: unknown, moh: Food[]) {
  const data = b as Partial<Backup> | null;
  if (!data || typeof data !== 'object' || !TABLES.some((t) => Array.isArray(data[t])) || TABLES.some((t) => data[t] != null && !Array.isArray(data[t])))
    throw new Error('זה לא קובץ גיבוי');
  const base = new Map(moh.map((f) => [f.id, f]));
  const source: { [K in TableName]: object[] } = {
    Food: (data.Food ?? []).map((f) => ({ ...base.get(f.id), ...f })),
    Entry: data.Entry ?? [],
    SavedMeal: data.SavedMeal ?? [],
    // A backup's profile id belongs to whoever made it; the row here is always the signed-in user's.
    Profile: (data.Profile ?? []).slice(0, 1).map(({ id: _, ...p }) => p),
  };
  for (const t of TABLES) {
    const rows = source[t].map((r) => clean(t, r));
    for (const c of chunks(rows)) {
      const { error } = await supabase.from(TABLE[t]).upsert(c, { onConflict: CONFLICT[t] });
      if (error) throw error;
    }
    if (t === 'Profile') continue;
    const keep = new Set(rows.map((r) => r.id));
    const stale = (await listAll(t)).map((r) => r.id).filter((id) => !keep.has(id));
    for (const c of chunks(stale)) {
      const { error } = await supabase.from(TABLE[t]).delete().in('id', c);
      if (error) throw error;
    }
  }
}
