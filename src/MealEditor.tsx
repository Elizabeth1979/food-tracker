import { useMemo, useState } from 'react';
import type { Ctx } from './App';
import { amountLabel, client, json, searchFoods, store, sum, type Food, type Item, type SavedMeal } from './lib';
import { FoodSummary, Modal } from './ui';
import { Amount, NutLine } from './AddDialog';

// Build or edit a saved meal (a bundle of foods with fixed amounts).
export function MealEditor({ ctx, meal, onClose }: { ctx: Ctx; meal?: SavedMeal; onClose: () => void }) {
  const [name, setName] = useState(meal?.name ?? '');
  const [items, setItems] = useState<Item[]>(() => json<Item[]>(meal?.items, []));
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Food | null>(null);
  const [err, setErr] = useState('');
  const hits = useMemo(() => searchFoods(ctx.foods, q, store.get('recent', [])), [ctx.foods, q]);

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
        <div key={i} className="row static">
          <div className="grow"><div>{it.name}</div><small className="accent">{amountLabel(it)}</small></div>
          <b>{it.kcal}</b><button className="icon" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="הסר">✕</button>
        </div>
      ))}
      {items.length > 0 && <NutLine n={sum(items)} />}
      {sel ? (
        <div className="picked">
          <button className="link" onClick={() => setSel(null)}>→ חזרה לחיפוש</button>
          <h3>{sel.name}</h3>
          <Amount food={sel} onPick={(it) => { setItems([...items, it]); setSel(null); setQ(''); }} cta="הוסף לארוחה" />
        </div>
      ) : (
        <>
          <input className="search" placeholder="הוסף מזון לארוחה…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <div className="list">
              {hits.map((f) => (
                <button key={f.id} className="row" onClick={() => setSel(f)}>
                  <div className="grow"><div>{f.name}</div><FoodSummary f={f} /></div><b>{f.kcal}</b>
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
