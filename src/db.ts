// Local-only data store: one IndexedDB key per table, cached in memory.
// `client.models.X` mirrors the subset of the old Amplify Data client the app uses.
import { get, set, setMany } from 'idb-keyval';
import type { MealKey } from './lib';

type Micros = { sodium?: number | null; calcium?: number | null; potassium?: number | null; b12?: number | null };
type Nutrients = { kcal: number; carbs: number; fat: number; protein: number } & Micros;

// Nutrients are per `servingG` grams. units: [{ n: name, g: grams }] (array or JSON string)
export type Food = Nutrients & { id: string; name: string; nameEn?: string | null; source?: string | null; hidden?: boolean | null; servingG: number; units?: unknown };
// One logged item. Nutrients are totals for the logged amount (snapshot). date: YYYY-MM-DD local
export type Entry = Nutrients & { id: string; date: string; meal: MealKey; foodId?: string | null; name: string; grams: number; qty?: number | null; unit?: string | null };
// items: JSON string of Item[]
export type SavedMeal = { id: string; name: string; items: unknown };
export type Profile = { id: string; kcal?: number | null; carbs?: number | null; fat?: number | null; protein?: number | null };

type Tables = { Food: Food; Entry: Entry; SavedMeal: SavedMeal; Profile: Profile };
export type TableName = keyof Tables;
export const TABLES: TableName[] = ['Food', 'Entry', 'SavedMeal', 'Profile'];
export type Backup = { [K in TableName]: Tables[K][] };
type Res<T> = { data: T; errors?: { message: string }[] };

// Ask the browser not to evict our data under storage pressure.
navigator.storage?.persist?.().catch(() => undefined);

// Every caller shares one array per table, so concurrent writes never drop rows.
const cache = new Map<TableName, Promise<unknown[]>>();
const rows = <K extends TableName>(t: K) => {
  if (!cache.has(t)) cache.set(t, get<Tables[K][]>(t).then((v) => v ?? []));
  return cache.get(t) as Promise<Tables[K][]>;
};
const persist = async (t: TableName) => set(t, await rows(t));

function model<K extends TableName>(t: K) {
  type T = Tables[K];
  return {
    list: async (): Promise<Res<T[]>> => ({ data: [...(await rows(t))] }),
    create: async (input: Omit<T, 'id'> & { id?: string }): Promise<Res<T>> => {
      const row = { ...input, id: input.id ?? crypto.randomUUID() } as T;
      (await rows(t)).push(row);
      await persist(t);
      return { data: row };
    },
    // Upsert-merge: also how a MoH food gets a local override (e.g. { id, hidden: true }).
    update: async (input: Partial<T> & { id: string }): Promise<Res<T>> => {
      const r = await rows(t);
      const i = r.findIndex((x) => x.id === input.id);
      const row = { ...r[i], ...input } as T;
      if (i < 0) r.push(row); else r[i] = row;
      await persist(t);
      return { data: row };
    },
    delete: async ({ id }: { id: string }): Promise<Res<null>> => {
      const r = await rows(t);
      const i = r.findIndex((x) => x.id === id);
      if (i >= 0) { r.splice(i, 1); await persist(t); }
      return { data: null };
    },
  };
}

export const client = {
  models: { Food: model('Food'), Entry: model('Entry'), SavedMeal: model('SavedMeal'), Profile: model('Profile') },
};

export const exportAll = async (): Promise<Backup> =>
  Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await rows(t)]))) as Backup;

// Replaces every table. Throws on a file that isn't a backup, before touching anything.
export async function restoreAll(b: unknown) {
  const data = b as Partial<Backup> | null;
  if (!data || typeof data !== 'object' || !TABLES.some((t) => Array.isArray(data[t])) || TABLES.some((t) => data[t] != null && !Array.isArray(data[t])))
    throw new Error('זה לא קובץ גיבוי');
  const entries = TABLES.map((t) => [t, data[t] ?? []] as [TableName, unknown[]]);
  await setMany(entries);
  entries.forEach(([t, v]) => cache.set(t, Promise.resolve(v)));
}
