import { useMemo, useState } from 'react';
import type { Ctx } from './App';
import { MEALS, client, json, mealNow, readLabel, searchFoods, sum, type Entry, type Food, type Item, type SavedMeal, type Unit } from './lib';
import { FoodSummary, Modal, PhotoPick } from './ui';
import { MealEditor } from './MealEditor';
import { AddDialog } from './AddDialog';

const FIELDS = [
  ['kcal', 'קלוריות', true], ['carbs', 'פחמימות (ג׳)', true], ['fat', 'שומן (ג׳)', true], ['protein', 'חלבון (ג׳)', true],
  ['sodium', 'נתרן (מ״ג)', false], ['calcium', 'סידן (מ״ג)', false], ['potassium', 'אשלגן (מ״ג)', false], ['b12', 'B12 (מק״ג)', false],
] as const;

export function FoodForm({ init, onSaved }: { init: Partial<Food>; onSaved: (f: Food) => void }) {
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(['name', 'servingG', ...FIELDS.map((f) => f[0])].map((k) => [k, String((init as any)[k] ?? (k === 'servingG' ? 100 : ''))])));
  const [units, setUnits] = useState<Unit[]>(() => json<Unit[]>(init.units, []));
  const [err, setErr] = useState('');
  const [label, setLabel] = useState<'busy' | 'done' | 'serving' | ''>('');
  const num = (k: string) => (v[k] === '' ? null : Number(v[k]));
  // Supplements (creatine, vitamins): no energy or macros, logged by the serving.
  // With nothing to scale, the serving is just the scoop: 5 g unless one was typed over the 100 g default.
  const supplement = () => {
    const g = v.servingG === '100' || !Number(v.servingG) ? '5' : v.servingG;
    setV({ ...v, servingG: g, kcal: '0', carbs: '0', fat: '0', protein: '0' });
    if (!units.some((u) => u.n)) setUnits([{ n: 'מנה', g: Number(g) }]);
  };
  // Fills the form from a photo of the package's nutrition table; everything stays editable until שמור.
  const photo = async (file: File) => {
    setErr(''); setLabel('busy');
    try {
      const l = await readLabel(file);
      const vals = Object.fromEntries(FIELDS.map(([k]) => [k, l[k] == null ? '' : String(l[k])]));
      setV((v) => ({ ...v, ...vals, name: v.name.trim() || l.name, servingG: '100' }));
      if (l.unit) setUnits((us) => [...us.filter((u) => u.n && u.n !== l.unit!.n), l.unit!]);
      setLabel(l.perServing ? 'serving' : 'done');
    } catch (x: any) { setErr(x.message); setLabel(''); }
  };
  const save = async () => {
    if (!v.name.trim() || FIELDS.some(([k, , req]) => req && num(k) == null)) return setErr('יש למלא שם, קלוריות ומקרו־נוטריינטים');
    const input = {
      name: v.name.trim(), servingG: num('servingG') || 100, source: 'user', // app edits win over the shipped food files
      kcal: num('kcal')!, carbs: num('carbs')!, fat: num('fat')!, protein: num('protein')!, sodium: num('sodium'), calcium: num('calcium'), potassium: num('potassium'), b12: num('b12'),
      units: JSON.stringify(units.filter((u) => u.n && u.g > 0)),
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
      <PhotoPick take="צלם טבלת ערכים" busy={label === 'busy'} busyText="קורא את הטבלה…" onFile={photo} />
      {(label === 'done' || label === 'serving') && (
        <p className="muted small" role="status">
          הערכים מולאו מהתמונה{label === 'serving' ? ' וחושבו ל־100 גרם לפי משקל המנה' : ''}. כדאי לבדוק אותם מול האריזה לפני השמירה.
        </p>
      )}
      {inp('name', 'שם')}
      {inp('servingG', 'הערכים הם עבור (גרם)')}
      <button className="link start" onClick={supplement}>💊 תוסף תזונה / ללא קלוריות: מלא אפסים</button>
      <div className="grid2">{FIELDS.map(([k, l]) => inp(k, l))}</div>
      <h4>יחידות (אופציונלי)</h4>
      {units.map((u, i) => (
        <div key={i} className="amount-row">
          <input placeholder="שם יחידה, למשל ״פרוסה״" value={u.n} onChange={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, n: e.target.value } : x)))} />
          <input type="number" inputMode="decimal" placeholder="גרם" value={u.g || ''} onChange={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, g: Number(e.target.value) } : x)))} />
          <button className="icon" onClick={() => setUnits(units.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="link" onClick={() => setUnits([...units, { n: '', g: 0 }])}>＋ הוסף יחידה</button>
      {err && <p className="error">{err}</p>}
      <button className="btn primary" onClick={save}>שמור</button>
    </div>
  );
}

export default function Foods({ ctx, date }: { ctx: Ctx; date: string }) {
  const [q, setQ] = useState('');
  const [logging, setLogging] = useState<Food | null>(null);
  const [msg, setMsg] = useState('');
  const logged = (es: Entry[]) => setMsg(`״${es[0]?.name}״ נוסף ל${MEALS.find((m) => m.key === es[0]?.meal)?.label ?? 'יומן'} ✓`);
  const [edit, setEdit] = useState<Partial<Food> | null>(null);
  const [mealEdit, setMealEdit] = useState<SavedMeal | 'new' | null>(null);
  const hits = useMemo(() => (q ? searchFoods(ctx.foods, q, ctx.recent) : ctx.foods.filter((f) => f.source !== 'moh' && !f.hidden)), [ctx.foods, q, ctx.recent]);
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
  return (
    <div className="stack">
      <section className="card pad">
        <div className="amount-row"><h3 className="grow">ארוחות שמורות</h3><button className="btn primary small" onClick={() => setMealEdit('new')}>＋ חדשה</button></div>
        {!ctx.meals.length && <p className="muted">צור ארוחה כאן, או שמור ארוחה מהיומן עם ״☆ שמור כארוחה״.</p>}
        {ctx.meals.map((m) => {
          const items = json<Item[]>(m.items, []);
          return (
            <div key={m.id} className="row static">
              <div className="grow"><div>{m.name}</div><small className="muted">{items.map((i) => i.name).join(' · ')}</small></div>
              <b>{sum(items).kcal}</b><button className="icon" onClick={() => setMealEdit(m)}>✎</button><button className="icon" onClick={() => delMeal(m.id)}>🗑</button>
            </div>
          );
        })}
      </section>
      <section className="card pad">
        <h3>מאגר מזונות <small className="muted">({ctx.foods.filter((f) => !f.hidden).length})</small></h3>
        <div className="amount-row">
          <input className="search" placeholder="חיפוש…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn primary" onClick={() => setEdit({ name: q })}>＋ חדש</button>
        </div>
        <div className="muted small">{q ? 'הקש על מזון כדי להוסיף אותו ליומן · ✎ עריכה · 🗑 הסתרה מהחיפוש' : 'המזונות שהוספת. חפש כדי לראות גם את מאגר משרד הבריאות.'}</div>
        {msg && <button className="banner" onClick={() => setMsg('')}>{msg}</button>}
        <div className="list">
          {hits.map((f) => (
            <div key={f.id} className="row" role="button" tabIndex={0} aria-label={`הוסף ליומן: ${f.name}`} onClick={() => setLogging(f)} onKeyDown={(e) => e.key === 'Enter' && setLogging(f)}>
              <div className="grow"><div>{f.name}</div><FoodSummary f={f} /></div>
              <button className="icon" aria-label="עריכה" onClick={(e) => { e.stopPropagation(); setEdit(f); }}>✎</button>
              <button className="icon" aria-label="הסתרה" onClick={(e) => { e.stopPropagation(); hide(f); }}>🗑</button>
            </div>
          ))}
        </div>
      </section>
      {logging && <AddDialog ctx={ctx} meal={mealNow()} date={date} initial={logging} onClose={() => setLogging(null)} onAdded={logged} />}
      {mealEdit && <MealEditor ctx={ctx} meal={mealEdit === 'new' ? undefined : mealEdit} onClose={() => setMealEdit(null)} />}
      {edit && <Modal title={edit.id ? 'עריכת מזון' : 'מזון חדש'} onClose={() => setEdit(null)}><FoodForm init={edit} onSaved={saved} /></Modal>}
    </div>
  );
}
