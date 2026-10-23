// Adds the MoH (Tzameret) vitamins and minerals to public/foods/moh.json as each food's `extra`, per 100 g,
// keyed like VITAMINS in src/lib.ts. Run: node scripts/moh-vitamins.ts (needs data.gov.il; the CSV download is blocked, the API isn't;
// behind a proxy add NODE_USE_ENV_PROXY=1).
// Unknown (empty) and zero values are left out. Biotin and iodine are missing for most foods, so they stay label-only.
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://data.gov.il/api/3/action/datastore_search?resource_id=c3cb0630-0650-46c1-a068-82d575c094b2&limit=5000';
const FILE = new URL('../public/foods/moh.json', import.meta.url);
// Tzameret column → app name. Units as in USDA SR: vitamin A as RAE.
const COLUMNS: Record<string, string> = {
  vitamin_a_re: 'ויטמין A (מק״ג)', vitamin_d: 'ויטמין D (מק״ג)', vitamin_e: 'ויטמין E (מ״ג)', vitamin_k: 'ויטמין K (מק״ג)', vitamin_c: 'ויטמין C (מ״ג)',
  thiamin: 'ויטמין B1 (מ״ג)', riboflavin: 'ויטמין B2 (מ״ג)', niacin: 'ויטמין B3 (מ״ג)', pantothenic_acid: 'ויטמין B5 (מ״ג)', vitamin_b6: 'ויטמין B6 (מ״ג)',
  folate: 'חומצה פולית (מק״ג)', iron: 'ברזל (מ״ג)', magnesium: 'מגנזיום (מ״ג)', zinc: 'אבץ (מ״ג)', selenium: 'סלניום (מק״ג)',
  copper: 'נחושת (מ״ג)', manganese: 'מנגן (מ״ג)', phosphorus: 'זרחן (מ״ג)', choline: 'כולין (מ״ג)',
};

const res = await fetch(API);
if (!res.ok) throw new Error(`data.gov.il ${res.status}`);
const rows: Record<string, unknown>[] = (await res.json()).result.records;
const byCode = new Map(rows.map((r) => [`moh-${r.Code}`, r]));
const foods: { id: string; extra?: Record<string, number> }[] = JSON.parse(readFileSync(FILE, 'utf8'));
let missing = 0;
for (const f of foods) {
  const r = byCode.get(f.id);
  if (!r) { missing++; continue; }
  const extra = Object.fromEntries(Object.entries(COLUMNS).map(([col, key]) => [key, Number(r[col])]).filter(([, v]) => (v as number) > 0));
  if (Object.keys(extra).length) f.extra = extra; else delete f.extra;
}
writeFileSync(FILE, JSON.stringify(foods));
console.log(`${foods.length} foods, ${missing} not in the API`);
