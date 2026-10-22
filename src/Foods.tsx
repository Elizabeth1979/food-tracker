import { useMemo, useState, type ReactNode } from 'react';
import type { Ctx } from './App';
import { MEALS, client, json, mealNow, readLabel, searchFoods, sum, type Entry, type Food, type Item, type SavedMeal, type Unit } from './lib';
import { Group, FoodSummary, Modal, PhotoPick, UNIT_HINT, UnitInputs, draftOf, unitOf, type UnitDraft } from './ui';
import { MealEditor } from './MealEditor';
import { AddDialog } from './AddDialog';
import { Icon } from './icons';

const FIELDS = [
  ['kcal', 'קלוריות', true], ['carbs', 'פחמימות (ג׳)', true], ['fat', 'שומן (ג׳)', true], ['protein', 'חלבון (ג׳)', true],
  ['sodium', 'נתרן (מ״ג)', false], ['calcium', 'סידן (מ״ג)', false], ['potassium', 'אשלגן (מ״ג)', false], ['b12', 'B12 (מק״ג)', false],
] as const;

export function FoodForm({ init, onSaved }: { init: Partial<Food>; onSaved: (f: Food) => void }) {
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(['name', 'servingG', ...FIELDS.map((f) => f[0])].map((k) => [k, String((init as any)[k] ?? (k === 'servingG' ? 100 : ''))])));
  const [units, setUnits] = useState<UnitDraft[]>(() => json<Unit[]>(init.units, []).map(draftOf));
  const [err, setErr] = useState('');
  const [label, setLabel] = useState<'done' | 'serving' | ''>('');
  const [reading, setReading] = useState<File | null>(null); // the label photo being read
  const num = (k: string) => (v[k] === '' ? null : Number(v[k]));
  // Supplements (creatine, vitamins): no energy or macros, logged by the serving.
  // With nothing to scale, the serving is just the scoop: 5 g unless one was typed over the 100 g default.
  const supplement = () => {
    const g = v.servingG === '100' || !Number(v.servingG) ? '5' : v.servingG;
    setV({ ...v, servingG: g, kcal: '0', carbs: '0', fat: '0', protein: '0' });
    if (!units.some((u) => u.n)) setUnits([{ k: '1', n: 'מנה', g }]);
  };
  // Fills the form from a photo of the package's nutrition table; everything stays editable until שמור.
  const photo = async (file: File) => {
    setErr(''); setReading(file);
    try {
      const l = await readLabel(file);
      const vals = Object.fromEntries(FIELDS.map(([k]) => [k, l[k] == null ? '' : String(l[k])]));
      setV((v) => ({ ...v, ...vals, name: v.name.trim() || l.name, servingG: '100' }));
      if (l.unit) setUnits((us) => [...us.filter((u) => u.n && u.n !== l.unit!.n), draftOf(l.unit!)]);
      setLabel(l.perServing ? 'serving' : 'done');
    } catch (x: any) { setErr(x.message); setLabel(''); } finally { setReading(null); }
  };
  const save = async () => {
    if (!v.name.trim() || FIELDS.some(([k, , req]) => req && num(k) == null)) return setErr('יש למלא שם, קלוריות ומקרו־נוטריינטים');
    const input = {
      name: v.name.trim(), servingG: num('servingG') || 100, source: 'user', // app edits win over the shipped food files
      kcal: num('kcal')!, carbs: num('carbs')!, fat: num('fat')!, protein: num('protein')!, sodium: num('sodium'), calcium: num('calcium'), potassium: num('potassium'), b12: num('b12'),
      units: JSON.stringify(units.map(unitOf).filter((u) => u.n && u.g > 0)),
    };
    const { data, errors } = init.id ? await client.models.Food.update({ id: init.id, ...input }) : await client.models.Food.create(input);
    if (errors) return setErr(errors[0].message);
    onSaved(data!);
  };
  const inp = (k: string, label: string) => (
    <label key={k}><span>{label}</span><input type={k === 'name' ? 'text' : 'number'} inputMode={k === 'name' ? 'text' : 'decimal'} step="any" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
  );
  return (
    <div className="form">
      <PhotoPick camera="צילום טבלת ערכים" gallery="טבלה מהגלריה" reading={reading} busyText="קורא את הטבלה…" onFile={photo} />
      {(label === 'done' || label === 'serving') && (
        <p className="muted small" role="status">
          הערכים מולאו מהתמונה{label === 'serving' ? ' וחושבו ל־100 גרם לפי משקל המנה' : ''}. כדאי לבדוק אותם מול האריזה לפני השמירה.
        </p>
      )}
      {inp('name', 'שם')}
      {inp('servingG', 'הערכים הם עבור (גרם)')}
      <button className="link start" onClick={supplement}><Icon name="pill" />תוסף תזונה / ללא קלוריות: מלא אפסים</button>
      <div className="grid2">{FIELDS.map(([k, l]) => inp(k, l))}</div>
      <h4>יחידות (אופציונלי)</h4>
      <p className="muted small">{UNIT_HINT}</p>
      {units.map((u, i) => (
        <div key={i} className="unit-row">
          <UnitInputs d={u} set={(d) => setUnits(units.map((x, j) => (j === i ? d : x)))} />
          <button className="icon" aria-label="מחק יחידה" onClick={() => setUnits(units.filter((_, j) => j !== i))}><Icon name="x" /></button>
        </div>
      ))}
      <button className="link" onClick={() => setUnits([...units, { k: '1', n: '', g: '' }])}><Icon name="plus" />הוסף יחידה</button>
      {err && <p className="error">{err}</p>}
      <button className="btn primary" onClick={save}>שמור</button>
    </div>
  );
}

export default function Foods({ ctx, date }: { ctx: Ctx; date: string }) {
  const [q, setQ] = useState('');
  const [logging, setLogging] = useState<Food | null>(null);
  const [msg, setMsg] = useState('');
  const logged = (es: Entry[]) => setMsg(`״${es[0]?.name}״ נוסף ל${MEALS.find((m) => m.key === es[0]?.meal)?.label ?? 'יומן'}`);
  const [edit, setEdit] = useState<Partial<Food> | null>(null);
  const [mealEdit, setMealEdit] = useState<SavedMeal | 'new' | null>(null);
  const hits = useMemo(() => (q ? searchFoods(ctx.foods, q, ctx.recent) : []), [ctx.foods, q, ctx.recent]);
  const saved = (f: Food) => { ctx.setFoods(edit?.id ? ctx.foods.map((x) => (x.id === f.id ? f : x)) : [...ctx.foods, f]); setEdit(null); };
  const hide = async (f: Food) => {
    if (!confirm(`להסיר את "${f.name}" מהרשימה?`)) return;
    await client.models.Food.update({ ...f, hidden: true }); // whole food: a MoH food has no row of its own yet
    ctx.setFoods(ctx.foods.map((x) => (x.id === f.id ? { ...x, hidden: true } : x)));
  };
  const delMeal = async (id: string) => {
    if (!confirm('למחוק את הארוחה השמורה?')) return;
    await client.models.SavedMeal.delete({ id });
    ctx.setMeals(ctx.meals.filter((m) => m.id !== id));
  };
  const mine = ctx.foods.filter((f) => f.source !== 'moh' && !f.hidden);
  const foodRow = (f: Food) => (
    <div key={f.id} className="row" role="button" tabIndex={0} aria-label={`הוסף ליומן: ${f.name}`} onClick={() => setLogging(f)} onKeyDown={(e) => e.key === 'Enter' && setLogging(f)}>
      <div className="grow"><div>{f.name}</div><FoodSummary f={f} /></div>
      <button className="icon" aria-label={`עריכה: ${f.name}`} onClick={(e) => { e.stopPropagation(); setEdit(f); }}><Icon name="pencil" /></button>
      <button className="icon" aria-label={`הסתרה: ${f.name}`} onClick={(e) => { e.stopPropagation(); hide(f); }}><Icon name="trash" /></button>
    </div>
  );
  const mealRow = (m: SavedMeal) => {
    const items = json<Item[]>(m.items, []);
    return (
      <div key={m.id} className="row static">
        <div className="grow"><div>{m.name}</div><small className="muted">{items.length === 1 ? 'מזון אחד' : `${items.length} מזונות`}</small></div>
        <b>{sum(items).kcal}</b><button className="icon" aria-label={`עריכה: ${m.name}`} onClick={() => setMealEdit(m)}><Icon name="pencil" /></button><button className="icon" aria-label={`מחיקה: ${m.name}`} onClick={() => delMeal(m.id)}><Icon name="trash" /></button>
      </div>
    );
  };
  return (
    <div className="stack">
      <h1 className="page-title">מזונות</h1>
      {/* Search first, so typing shows its results right under the box; while searching, only results show */}
      <input className="search" type="search" aria-label="חיפוש במאגר" placeholder={`חיפוש בכל ${ctx.foods.filter((f) => !f.hidden).length} המזונות…`} value={q} onChange={(e) => setQ(e.target.value)} />
      {msg && <button className="banner" onClick={() => setMsg('')}>{msg}</button>}
      {q ? (
        <Group title={`תוצאות (${hits.length})`} action={<button className="btn small" onClick={() => setEdit({ name: q })}><Icon name="plus" />מזון חדש</button>}>
          <div className="muted small">הקשה מוסיפה ליומן. העיפרון עורך, הפח מסתיר מהחיפוש. ״שלי״: מזון שהוספת או ערכת.</div>
          <div className="list">{hits.map(foodRow)}</div>
        </Group>
      ) : <>
        <Group title={`המזונות שלי (${mine.length})`} action={<button className="btn small" onClick={() => setEdit({ name: '' })}><Icon name="plus" />מזון חדש</button>}>
          {mine.length ? <Fold items={mine} row={foodRow} /> : <p className="muted">מזונות שתוסיפו או תערכו יופיעו כאן.</p>}
        </Group>
        <Group title={`ארוחות שמורות (${ctx.meals.length})`} action={<button className="btn small" onClick={() => setMealEdit('new')}><Icon name="plus" />ארוחה חדשה</button>}>
          {ctx.meals.length ? <Fold items={ctx.meals} row={mealRow} /> : <p className="muted">צרו ארוחה כאן, או שמרו ארוחה מהיומן עם ״שמור כארוחה״.</p>}
        </Group>
        <p className="muted small">שאר המזונות, ממאגר משרד הבריאות, נמצאים בחיפוש.</p>
      </>}
      {logging && <AddDialog ctx={ctx} meal={mealNow()} date={date} fromFoods initial={logging} onClose={() => setLogging(null)} onAdded={logged} />}
      {mealEdit && <MealEditor ctx={ctx} meal={mealEdit === 'new' ? undefined : mealEdit} onClose={() => setMealEdit(null)} />}
      {edit && <Modal title={edit.id ? 'עריכת מזון' : 'מזון חדש'} onClose={() => setEdit(null)}><FoodForm init={edit} onSaved={saved} /></Modal>}
    </div>
  );
}

// A list that shows its first few and folds the rest behind "הצג הכל".
function Fold<T>({ items, row, shown = 5 }: { items: T[]; row: (x: T) => ReactNode; shown?: number }) {
  const [all, setAll] = useState(false);
  return <>
    {(all ? items : items.slice(0, shown)).map(row)}
    {items.length > shown && <button className="link" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'הצג פחות' : `הצג הכל (${items.length})`}</button>}
  </>;
}
