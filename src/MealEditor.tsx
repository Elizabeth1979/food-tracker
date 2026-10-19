import { useMemo, useState } from 'react';
import type { Ctx } from './App';
import { amountLabel, client, json, searchFoods, sum, type Food, type Item, type SavedMeal } from './lib';
import { FoodSummary, Modal } from './ui';
import { Amount, NutLine, itemFood, itemInit, unitSaver } from './AddDialog';

// Build or edit a saved meal (a bundle of foods with fixed amounts).
export function MealEditor({ ctx, meal, onClose }: { ctx: Ctx; meal?: SavedMeal; onClose: () => void }) {
  const [name, setName] = useState(meal?.name ?? '');
  const [items, setItems] = useState<Item[]>(() => json<Item[]>(meal?.items, []));
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Food | null>(null);
  const [edit, setEdit] = useState<number | null>(null); // index of the item being re-portioned
  const [err, setErr] = useState('');
  const hits = useMemo(() => searchFoods(ctx.foods, q, ctx.recent), [ctx.foods, q, ctx.recent]);

  const real = edit === null ? undefined : ctx.foods.find((x) => x.id === items[edit].foodId);

  const save = async () => {
    if (!name.trim() || !items.length) return setErr('יש לתת שם ולהוסיף לפחות מזון אחד');
    const input = { name: name.trim(), items: JSON.stringify(items) };
    const { data, errors } = meal ? await client.models.SavedMeal.update({ id: meal.id, ...input }) : await client.models.SavedMeal.create(input);
    if (errors) return setErr(errors[0].message);
    ctx.setMeals(meal ? ctx.meals.map((m) => (m.id === meal.id ? data! : m)) : [...ctx.meals, data!]);
    onClose();
  };

  return (
    <Modal title={meal ? 'עריכת ארוחה שמורה' : 'ארוחה שמורה חדשה'} onClose={onClose}>
      <div className="form"><label><span>שם הארוחה</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: בוקר קבוע" /></label></div>
      {items.map((it, i) => (
        <div key={i} className="row" role="button" tabIndex={0} onClick={() => { setEdit(i); setSel(itemFood(ctx.foods, it)); }}>
          <div className="grow"><div>{it.name}</div><small className="accent">{amountLabel(it)}</small></div>
          <b>{it.kcal}</b><button className="icon" onClick={(ev) => { ev.stopPropagation(); setItems(items.filter((_, j) => j !== i)); setSel(null); setEdit(null); }} aria-label="הסר">✕</button>
        </div>
      ))}
      {items.length > 0 && <NutLine n={sum(items)} />}
      {sel ? (
        <div className="picked">
          <button className="link" onClick={() => { setSel(null); setEdit(null); }}>→ חזרה לחיפוש</button>
          <h3>{sel.name}</h3>
          <Amount key={edit ?? sel.id} food={sel} init={edit === null ? undefined : itemInit(items[edit])} cta={edit === null ? 'הוסף לארוחה' : 'עדכן כמות'}
            onPick={(it) => { setItems(edit === null ? [...items, it] : items.map((x, j) => (j === edit ? it : x))); setSel(null); setEdit(null); setQ(''); }}
            onAddUnit={edit === null ? unitSaver(ctx, sel, setSel) : real && unitSaver(ctx, real)} />
        </div>
      ) : (
        <>
          <input className="search" placeholder="הוסף מזון לארוחה…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <div className="list">
              {hits.map((f) => (
                <button key={f.id} className="row" onClick={() => setSel(f)}>
                  <div className="grow"><div>{f.name}</div><FoodSummary f={f} /></div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {err && <p className="error">{err}</p>}
      <button className="btn primary" onClick={save}>שמור ארוחה</button>
    </Modal>
  );
}
