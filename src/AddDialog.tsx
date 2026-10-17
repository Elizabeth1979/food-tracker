import { useMemo, useState } from 'react';
import type { Ctx } from './App';
import { MEALS, addEntries, addUnit, json, amountLabel, client, fmtDate, itemFor, parseLine, readPhoto, scale, searchFoods, sum, today, unitsOf, type Entry, type Food, type Item, type MealKey, type Nut, type Parsed, type Unit } from './lib';
import { FoodSummary, MicroLine, Modal, PhotoPick } from './ui';
import { FoodForm } from './Foods';
import { ReviewList } from './Review';

export const NutLine = ({ n }: { n: Nut }) => (
  <div>
    <div className="nutline"><b>{n.kcal} קק״ל</b><span>פחמימות {n.carbs} ג׳</span><span>שומן {n.fat} ג׳</span><span>חלבון {n.protein} ג׳</span></div>
    <MicroLine n={n} />
  </div>
);

const PREFERRED = ['יחידה בינונית', 'יחידה', 'פרוסה', 'פרוסה בינונית', 'מנה בינונית'];

// qty + unit picker for a food; returns an Item. With onAddUnit, the unit list ends in "＋ יחידה חדשה".
export function Amount({ food, init, onPick, cta, onAddUnit }: { food: Food; init?: { qty: number; unit: string }; onPick: (it: Item) => void; cta: string; onAddUnit?: (u: Unit) => Promise<unknown> }) {
  const [extra, setExtra] = useState<Unit[]>([]);
  const units = [...unitsOf(food), ...extra.filter((u) => !unitsOf(food).some((x) => x.n === u.n))];
  const [unit, setUnit] = useState(() => units.find((u) => u.n === init?.unit)
    ?? (food.source === 'moh' ? PREFERRED.map((n) => units.find((u) => u.n === n)).find(Boolean) : units[1]) ?? units[0]);
  const [qty, setQty] = useState(String(init?.qty ?? (unit.g === 1 ? food.servingG : 1)));
  const [newUnit, setNewUnit] = useState<{ n: string; g: string } | null>(null);
  const it = itemFor(food, Number(qty) || 0, unit);
  const saveUnit = async () => {
    const u = { n: newUnit!.n.trim(), g: Number(newUnit!.g) };
    if (!u.n || !(u.g > 0)) return;
    await onAddUnit!(u);
    setExtra([...extra, u]); setUnit(u); setQty('1'); setNewUnit(null);
  };
  return (
    <div className="amount">
      <div className="amount-row">
        <input type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
        <select value={newUnit ? '+' : unit.n} onChange={(e) => {
          if (e.target.value === '+') return setNewUnit({ n: '', g: '' });
          const u = units.find((x) => x.n === e.target.value)!; setUnit(u); setQty(u.g === 1 ? String(food.servingG) : '1');
        }}>
          {units.map((u) => <option key={u.n} value={u.n}>{u.g === 1 ? u.n : `${u.n} (${u.g} ג׳)`}</option>)}
          {onAddUnit && <option value="+">＋ יחידה חדשה…</option>}
        </select>
      </div>
      {newUnit && (
        <div className="amount-row new-unit">
          <input placeholder="שם, למשל ״פרוסה״" value={newUnit.n} onChange={(e) => setNewUnit({ ...newUnit, n: e.target.value })} autoFocus />
          <input type="number" inputMode="decimal" placeholder="גרם" value={newUnit.g} onChange={(e) => setNewUnit({ ...newUnit, g: e.target.value })} />
          <button className="btn small primary" onClick={saveUnit}>שמור</button>
          <button className="icon" aria-label="ביטול" onClick={() => setNewUnit(null)}>✕</button>
        </div>
      )}
      <NutLine n={it} />
      <button className="btn primary" disabled={!it.grams} onClick={() => onPick(it)}>{cta}</button>
    </div>
  );
}

// Saves a new unit on the food and swaps the updated food into ctx.foods.
export const unitSaver = (ctx: Ctx, f: Food, then?: (f: Food) => void) => async (u: Unit) => {
  const nf = await addUnit(f, u);
  ctx.setFoods(ctx.foods.map((x) => (x.id === nf.id ? nf : x)));
  then?.(nf);
};

type Tab = 'foods' | 'text' | 'meals';

export function AddDialog({ ctx, meal: meal0, date, onClose, onAdded, savedTab, initial }: { ctx: Ctx; meal: MealKey; date: string; onClose: () => void; onAdded: (e: Entry[]) => void; savedTab?: boolean; initial?: Food }) {
  const [meal, setMeal] = useState(meal0);
  const [tab, setTab] = useState<Tab>(savedTab ? 'meals' : 'foods');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Food | null>(initial ?? null);
  const [creating, setCreating] = useState(false);
  const hits = useMemo(() => searchFoods(ctx.foods, q, ctx.recent), [ctx.foods, q, ctx.recent]);

  const add = async (items: Item[]) => {
    ctx.addRecent(items.flatMap((i) => (i.foodId ? [i.foodId] : [])));
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
    <Modal title={date === today() ? 'הוספה ליומן' : `הוספה ליומן · ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}`} onClose={onClose}>
      <div className="seg">
        {MEALS.map((m) => <button key={m.key} className={meal === m.key ? 'on' : ''} onClick={() => setMeal(m.key)}>{m.icon} {m.label.replace('ארוחת ', '')}</button>)}
      </div>
      {sel ? (
        <div className="picked">
          <button className="link" onClick={() => setSel(null)}>→ חזרה לחיפוש</button>
          <h3>{sel.name}</h3>
          <Amount key={sel.id} food={sel} onPick={(it) => add([it])} cta="הוסף" onAddUnit={unitSaver(ctx, sel, setSel)} />
        </div>
      ) : (
        <>
          <div className="seg">
            <button className={tab === 'foods' ? 'on' : ''} onClick={() => setTab('foods')}>🔍 חיפוש</button>
            <button className={tab === 'text' ? 'on' : ''} onClick={() => setTab('text')}>✍️ כתיבה ותמונה</button>
            <button className={tab === 'meals' ? 'on' : ''} onClick={() => setTab('meals')}>⭐ שמורות ({ctx.meals.length})</button>
          </div>
          {tab === 'foods' && (
            <>
              <input className="search" placeholder={ctx.foods.length ? `חיפוש ב-${ctx.foods.length} מזונות…` : 'טוען מזונות…'} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              <div className="list">
                {!q && hits.length > 0 && <div className="muted small">אחרונים</div>}
                {hits.map((f) => (
                  <button key={f.id} className="row" onClick={() => setSel(f)}>
                    <div className="grow"><div>{f.name}</div><FoodSummary f={f} /></div>
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => setCreating(true)}>＋ מזון חדש{q && `: ${q}`}</button>
            </>
          )}
          {tab === 'text' && <TextOrPhoto ctx={ctx} onAdd={add} />}
          {tab === 'meals' && (
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

// A whole meal in one go: typed ("יוגורט 150 גרם, 10 ענבים") or from a photo, then checked in a review list.
function TextOrPhoto({ ctx, onAdd }: { ctx: Ctx; onAdd: (items: Item[]) => void }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Parsed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const photo = async (file: File) => {
    setErr(''); setBusy(true);
    try { setParsed(await readPhoto(file, text)); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  if (parsed)
    return (
      <>
        <button className="link" onClick={() => setParsed(null)}>→ חזרה לעריכה</button>
        <ReviewList ctx={ctx} parsed={parsed} cta="הוסף ליומן" onAdd={onAdd} />
      </>
    );
  return (
    <div className="form">
      <label>
        <span>מה אכלת? אפשר עם כמויות, מופרד בפסיקים</span>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="יוגורט 150 גרם, 10 ענבים, כף חמאת בוטנים, 2 כפות גרנולה" autoFocus />
      </label>
      <button className="btn primary" disabled={!text.trim() || busy} onClick={() => setParsed(parseLine(text))}>המשך לבדיקה</button>
      <PhotoPick take="צלם ארוחה" busy={busy} busyText="מזהה מזונות בתמונה…" onFile={photo} />
      <p className="muted small">בתמונה כדאי לכתוב גם הערה קצרה למעלה (״כף חמאת בוטנים בפנים״), כדי לדייק כמויות ודברים שלא רואים.</p>
      {err && <p className="error">{err}</p>}
    </div>
  );
}

export function EntryDialog({ ctx, entry, onClose, onSaved, onDelete }: { ctx: Ctx; entry: Entry; onClose: () => void; onSaved: (e: Entry) => void; onDelete: () => void }) {
  const [meal, setMeal] = useState(entry.meal as MealKey);
  // Rescale from the entry's own snapshot so it works even if the food was edited or removed.
  const real = ctx.foods.find((x) => x.id === entry.foodId);
  const food = useMemo(() => {
    const f = real;
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
      <Amount food={food} init={{ qty: entry.unit && entry.unit !== 'גרם' ? entry.qty ?? 1 : entry.grams, unit: entry.unit ?? 'גרם' }} onPick={save} cta="שמור"
        onAddUnit={real ? unitSaver(ctx, real) : undefined} />
      <button className="btn danger" onClick={onDelete}>מחק</button>
    </Modal>
  );
}
