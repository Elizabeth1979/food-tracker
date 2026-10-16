import { useMemo, useState } from 'react';
import type { Ctx } from './App';
import { MEALS, addEntries, json, amountLabel, client, itemFor, pushRecent, scale, searchFoods, store, sum, unitsOf, type Entry, type Food, type Item, type MealKey, type Nut } from './lib';
import { FoodSummary, MicroLine, Modal } from './ui';
import { FoodForm } from './Foods';

export const NutLine = ({ n }: { n: Nut }) => (
  <div>
    <div className="nutline"><b>{n.kcal} קק״ל</b><span>פחמ׳ {n.carbs}</span><span>שומן {n.fat}</span><span>חלבון {n.protein}</span></div>
    <MicroLine n={n} />
  </div>
);

const PREFERRED = ['יחידה בינונית', 'יחידה', 'פרוסה', 'פרוסה בינונית', 'מנה בינונית'];

// qty + unit picker for a food; returns an Item
export function Amount({ food, init, onPick, cta }: { food: Food; init?: { qty: number; unit: string }; onPick: (it: Item) => void; cta: string }) {
  const units = unitsOf(food);
  const [unit, setUnit] = useState(() => units.find((u) => u.n === init?.unit)
    ?? (food.source === 'moh' ? PREFERRED.map((n) => units.find((u) => u.n === n)).find(Boolean) : units[1]) ?? units[0]);
  const [qty, setQty] = useState(String(init?.qty ?? (unit.g === 1 ? food.servingG : 1)));
  const it = itemFor(food, Number(qty) || 0, unit);
  return (
    <div className="amount">
      <div className="amount-row">
        <input type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
        <select value={unit.n} onChange={(e) => { const u = units.find((x) => x.n === e.target.value)!; setUnit(u); setQty(u.g === 1 ? String(food.servingG) : '1'); }}>
          {units.map((u) => <option key={u.n} value={u.n}>{u.g === 1 ? u.n : `${u.n} (${u.g} ג׳)`}</option>)}
        </select>
      </div>
      <NutLine n={it} />
      <button className="btn primary" disabled={!it.grams} onClick={() => onPick(it)}>{cta}</button>
    </div>
  );
}

export function AddDialog({ ctx, meal: meal0, date, onClose, onAdded, savedTab }: { ctx: Ctx; meal: MealKey; date: string; onClose: () => void; onAdded: (e: Entry[]) => void; savedTab?: boolean }) {
  const [meal, setMeal] = useState(meal0);
  const [tab, setTab] = useState<'foods' | 'meals'>(savedTab ? 'meals' : 'foods');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);
  const hits = useMemo(() => searchFoods(ctx.foods, q, store.get('recent', [])), [ctx.foods, q]);

  const add = async (items: Item[]) => {
    items.forEach((i) => i.foodId && pushRecent(i.foodId));
    onAdded(await addEntries(date, meal, items));
    onClose();
  };

  if (creating)
    return (
      <Modal title="מזון חדש" onClose={() => setCreating(false)}>
        <FoodForm init={{ name: q }} onSaved={(f) => { ctx.setFoods([...ctx.foods, f]); setCreating(false); setSel(f); }} />
      </Modal>
    );
  return (
    <Modal title="הוספה ליומן" onClose={onClose}>
      <div className="seg">
        {MEALS.map((m) => <button key={m.key} className={meal === m.key ? 'on' : ''} onClick={() => setMeal(m.key)}>{m.icon} {m.label.replace('ארוחת ', '')}</button>)}
      </div>
      {sel ? (
        <div className="picked">
          <button className="link" onClick={() => setSel(null)}>→ חזרה לחיפוש</button>
          <h3>{sel.name}</h3>
          <Amount food={sel} onPick={(it) => add([it])} cta="הוסף" />
        </div>
      ) : (
        <>
          <div className="seg">
            <button className={tab === 'foods' ? 'on' : ''} onClick={() => setTab('foods')}>מזונות</button>
            <button className={tab === 'meals' ? 'on' : ''} onClick={() => setTab('meals')}>ארוחות שמורות ({ctx.meals.length})</button>
          </div>
          {tab === 'foods' ? (
            <>
              <input className="search" placeholder={ctx.foods.length ? `חיפוש ב-${ctx.foods.length} מזונות…` : 'טוען מזונות…'} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              <div className="list">
                {!q && hits.length > 0 && <div className="muted small">אחרונים</div>}
                {hits.map((f) => (
                  <button key={f.id} className="row" onClick={() => setSel(f)}>
                    <div className="grow"><div>{f.name}</div><FoodSummary f={f} /></div>
                    <b>{f.kcal}</b>
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => setCreating(true)}>＋ מזון חדש{q && `: ${q}`}</button>
            </>
          ) : (
            <div className="list">
              {!ctx.meals.length && <p className="muted">עוד אין ארוחות שמורות. שמור ארוחה מהיומן עם ״☆ שמור כארוחה״.</p>}
              {ctx.meals.map((m) => {
                const items = json<Item[]>(m.items, []);
                return (
                  <button key={m.id} className="row" onClick={() => add(items)}>
                    <div className="grow"><div>{m.name}</div><small className="muted">{items.map((i) => i.name).join(' · ')}</small></div>
                    <b>{sum(items).kcal}</b>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export function EntryDialog({ ctx, entry, onClose, onSaved, onDelete }: { ctx: Ctx; entry: Entry; onClose: () => void; onSaved: (e: Entry) => void; onDelete: () => void }) {
  const [meal, setMeal] = useState(entry.meal as MealKey);
  // Rescale from the entry's own snapshot so it works even if the food was edited or removed.
  const food = useMemo(() => {
    const f = ctx.foods.find((x) => x.id === entry.foodId);
    return { ...(f ?? {}), id: entry.foodId, name: entry.name, servingG: entry.grams, units: f?.units ?? null, ...scale(entry as Nut, 1) } as Food;
  }, [ctx.foods, entry]);
  const save = async (it: Item) => {
    const { data } = await client.models.Entry.update({ id: entry.id, meal, ...it });
    onSaved(data!);
  };
  return (
    <Modal title={entry.name} onClose={onClose}>
      <div className="muted small">{amountLabel(entry)}</div>
      <div className="seg">
        {MEALS.map((m) => <button key={m.key} className={meal === m.key ? 'on' : ''} onClick={() => setMeal(m.key)}>{m.icon} {m.label.replace('ארוחת ', '')}</button>)}
      </div>
      <Amount food={food} init={{ qty: entry.unit && entry.unit !== 'גרם' ? entry.qty ?? 1 : entry.grams, unit: entry.unit ?? 'גרם' }} onPick={save} cta="שמור" />
      <button className="btn danger" onClick={onDelete}>מחק</button>
    </Modal>
  );
}
