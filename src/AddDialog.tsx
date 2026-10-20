import { useEffect, useMemo, useState } from 'react';
import type { Ctx } from './App';
import { GRAMS, MEALS, addDays, addEntries, addUnit, json, amountLabel, client, fmtDate, itemFor, loadEntries, parseLine, pickItem, readPhoto, scale, searchFoods, sum, today, unitsOf, type Entry, type Food, type Item, type MealKey, type Nut, type Parsed, type Unit } from './lib';
import { norm } from './search';
import { FoodSummary, MicroLine, Modal, PhotoPick, UNIT_HINT, UnitInputs, unitOf, type UnitDraft } from './ui';
import { FoodForm } from './Foods';
import { ReviewList } from './Review';

export const NutLine = ({ n }: { n: Nut }) => (
  <div>
    <div className="nutline"><b>{n.kcal} קק״ל</b><span>פחמימות {n.carbs} ג׳</span><span>שומן {n.fat} ג׳</span><span>חלבון {n.protein} ג׳</span></div>
    <MicroLine n={n} />
  </div>
);

const PREFERRED = ['יחידה בינונית', 'יחידה', 'פרוסה', 'פרוסה בינונית', 'מנה בינונית'];

// Rescale from an item's own snapshot so it works even if the food was edited or removed.
export const itemFood = (foods: Food[], it: Item) => {
  const f = foods.find((x) => x.id === it.foodId);
  return { ...(f ?? {}), id: it.foodId, name: it.name, servingG: it.grams, units: f?.units ?? null, ...scale(it, 1) } as Food;
};
// An item's amount as the amount picker takes it: pieces as counted, grams as grams.
export const itemInit = (it: Item) => (it.unit && it.unit !== GRAMS ? { qty: it.qty ?? 1, unit: it.unit } : { qty: it.grams, unit: GRAMS });

// qty + unit picker for a food; returns an Item. With onAddUnit, the unit list ends in "＋ יחידה חדשה".
export function Amount({ food, init, onPick, cta, onAddUnit }: { food: Food; init?: { qty: number; unit: string }; onPick: (it: Item) => void; cta: string; onAddUnit?: (u: Unit) => Promise<unknown> }) {
  const [extra, setExtra] = useState<Unit[]>([]);
  const units = [...unitsOf(food), ...extra.filter((u) => !unitsOf(food).some((x) => x.n === u.n))];
  const [unit, setUnit] = useState(() => units.find((u) => u.n === init?.unit)
    ?? (food.source === 'moh' ? PREFERRED.map((n) => units.find((u) => u.n === n)).find(Boolean) : units[1]) ?? units[0]);
  const [qty, setQty] = useState(String(init?.qty ?? (unit.g === 1 ? food.servingG : 1)));
  const [newUnit, setNewUnit] = useState<UnitDraft | null>(null);
  const it = itemFor(food, Number(qty) || 0, unit);
  const saveUnit = async () => {
    const u = unitOf(newUnit!);
    if (!u.n || !(u.g > 0)) return;
    await onAddUnit!(u);
    setExtra([...extra, u]); setUnit(u); setQty('1'); setNewUnit(null);
  };
  return (
    <div className="amount">
      <div className="amount-row">
        <input type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
        <select value={newUnit ? '+' : unit.n} onChange={(e) => {
          if (e.target.value === '+') return setNewUnit({ k: '1', n: '', g: '' });
          const u = units.find((x) => x.n === e.target.value)!; setUnit(u); setQty(u.g === 1 ? String(food.servingG) : '1');
        }}>
          {units.map((u) => <option key={u.n} value={u.n}>{u.g === 1 ? u.n : `${u.n} (${u.g} ג׳)`}</option>)}
          {onAddUnit && <option value="+">＋ יחידה חדשה…</option>}
        </select>
      </div>
      {newUnit && (
        <div className="unit-row">
          <p className="muted small">{UNIT_HINT}</p>
          <UnitInputs d={newUnit} set={setNewUnit} autoFocus />
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

// Opens on what you usually eat at this meal, saved meals and single foods, each at the amount you had last time.
// One tap adds, a second tap takes it back out, and the dialog stays open until "סיום", so a whole meal is a few taps.
// Search, typing and photos are for the less usual things; those go through the amount picker.
// From a meal's ＋ in the diary: the title names the meal, with no meal buttons or back links; the phone's back
// button (or Esc) steps back from the amount or typing view to the list, and from the list closes it.
// `fromFoods` (a food tapped in the מזונות tab) keeps that tab's own look: meal buttons, "חזרה לחיפוש", 100 g.
export function AddDialog({ ctx, meal: meal0, date, fromFoods, onClose, onAdded, onRemoved, initial }: { ctx: Ctx; meal: MealKey; date: string; fromFoods?: boolean; onClose: () => void; onAdded: (e: Entry[]) => void; onRemoved?: (e: Entry[]) => void; initial?: Food }) {
  const [meal, setMeal] = useState(meal0);
  const [q, setQ] = useState('');
  const [writing, setWriting] = useState(false);
  const [sel, setSel] = useState<Food | null>(initial ?? null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  // What this visit added, keyed by the row that added it ("m:<saved meal>", "f:<food>", or one-off keys).
  const [done, setDone] = useState<Record<string, Entry[]>>({});
  // The past month, loaded once: the last amount of each food, and what you tend to have at each meal.
  const [month, setMonth] = useState<Entry[]>([]);
  useEffect(() => { loadEntries(addDays(date, -30), date).then(setMonth); }, [date]);
  const last = useMemo(() => {
    const m: Record<string, Entry> = {};
    for (const e of [...month].sort((a, b) => a.date.localeCompare(b.date))) if (e.foodId) m[e.foodId] = e;
    return m;
  }, [month]);
  const hits = useMemo(() => searchFoods(ctx.foods, q, ctx.recent), [ctx.foods, q, ctx.recent]);
  const meals = q ? ctx.meals.filter((m) => norm(m.name).includes(norm(q))) : ctx.meals;
  // Order fixed when the dialog opens: adding moves a food up in "recent", and rows mustn't jump under your finger.
  const [order] = useState(ctx.recent);
  // Whatever you've had most often at this meal comes first, saved meals and single foods alike;
  // a saved meal counts by how often its foods were at this meal. Ties: saved meals, then the most recent.
  const usual = useMemo(() => {
    const n: Record<string, number> = {};
    for (const e of month) if (e.foodId && e.meal === meal) n[e.foodId] = (n[e.foodId] ?? 0) + 1;
    const saved = ctx.meals.map((m, i) => {
      const items = json<Item[]>(m.items, []);
      const score = items.reduce((t, it) => t + (n[it.foodId ?? ''] ?? 0), 0) / (items.length || 1);
      return { key: `m:${m.id}`, m, items, score, i: i - 1000 };
    });
    const foods = searchFoods(ctx.foods, '', order).slice(0, 12).map((f, i) => ({ key: `f:${f.id}`, f, score: n[f.id] ?? 0, i }));
    return [...saved, ...foods].sort((a, b) => b.score - a.score || a.i - b.i);
  }, [ctx.foods, ctx.meals, order, month, meal]);
  const label = MEALS.find((m) => m.key === meal)!.label;
  const added = Object.values(done).flat();

  const add = async (key: string, items: Item[]) => {
    setBusy(true);
    try {
      ctx.addRecent(items.flatMap((i) => (i.foodId ? [i.foodId] : [])));
      const es = await addEntries(date, meal, items);
      onAdded(es);
      setDone((d) => ({ ...d, [key]: [...(d[key] ?? []), ...es] }));
    } finally { setBusy(false); }
    if (initial) onClose(); // opened on one food from the מזונות tab
    setSel(null); setWriting(false); setQ('');
  };
  const takeBack = async (key: string) => {
    const es = done[key];
    setDone(({ [key]: _, ...d }) => d);
    await Promise.all(es.map((e) => client.models.Entry.delete({ id: e.id })));
    onRemoved?.(es);
  };
  const toggle = (key: string, items: () => Item[] | null, food?: Food) => {
    if (busy) return;
    if (done[key]) return takeBack(key);
    const it = items();
    return it ? add(key, it) : setSel(food!); // no amount on record yet: ask once
  };

  if (creating)
    return (
      <Modal title="מזון חדש" onClose={() => setCreating(false)}>
        <FoodForm init={{ name: q }} onSaved={(f) => { ctx.setFoods([...ctx.foods, f]); setCreating(false); setSel(f); }} />
      </Modal>
    );
  return (
    <Modal title={`${fromFoods ? 'הוספה ליומן' : `הוספה ל${label}`}${date === today() ? '' : ` · ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}`}`} onClose={onClose}
      onBack={() => { if (sel && !initial) { setSel(null); return true; } if (writing) { setWriting(false); return true; } return false; }}>
      {fromFoods && (
        <div className="seg">
          {MEALS.map((m) => <button key={m.key} className={meal === m.key ? 'on' : ''} onClick={() => setMeal(m.key)}>{m.icon} {m.label.replace('ארוחת ', '')}</button>)}
        </div>
      )}
      {sel ? (
        <div className="picked">
          {fromFoods && <button className="link" onClick={() => setSel(null)}>→ חזרה לחיפוש</button>}
          <h3>{sel.name}</h3>
          <Amount key={`${sel.id}:${fromFoods ? '' : last[sel.id]?.id ?? ''}`} food={sel} init={fromFoods ? undefined : last[sel.id] && itemInit(last[sel.id] as Item)} onPick={(it) => add(`f:${sel.id}`, [it])} cta={fromFoods ? 'הוסף' : `הוסף ל${label}`} onAddUnit={unitSaver(ctx, sel, setSel)} />
        </div>
      ) : writing ? (
        <>
          <TextOrPhoto ctx={ctx} onAdd={(items) => add(`w:${Date.now()}`, items)} />
        </>
      ) : (
        <>
          <input className="search" type="search" aria-label="חיפוש" placeholder="חיפוש מזון…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="usual">
            {(q ? meals.map((m) => ({ key: `m:${m.id}`, m, items: json<Item[]>(m.items, []) })) : usual).map((r) => {
              if ('m' in r) return <Pick key={r.key} on={!!done[r.key]} name={r.m.name} saved detail={r.items.map((i) => i.name.split(',')[0]).join(' · ')}
                kcal={sum(r.items).kcal} onClick={() => toggle(r.key, () => r.items)} />;
              const e = last[r.f.id];
              return <Pick key={r.key} on={!!done[r.key]} name={r.f.name} detail={e ? amountLabel(e) : undefined}
                kcal={e?.kcal} onClick={() => toggle(r.key, () => (e ? [pickItem(e)] : null), r.f)} />;
            })}
            {q && hits.map((f) => (
              <button key={f.id} className="row" onClick={() => setSel(f)}>
                <div className="grow"><div>{f.name}</div><FoodSummary f={f} /></div>
              </button>
            ))}
            {!q && !usual.length && <p className="muted">מה שתרשמו יופיע כאן בפעם הבאה, להוספה בלחיצה אחת.</p>}
            {q && <button className="row muted" onClick={() => setCreating(true)}>＋ מזון חדש: ״{q}״</button>}
          </div>
          {!q && <button className="link start" onClick={() => setWriting(true)}>או כתבו מה אכלתם, או צלמו</button>}
        </>
      )}
      {/* Always there, so the sheet doesn't grow and shift the rows on the first tap. */}
      {!sel && !writing && (
        <button className="btn primary done" onClick={onClose}>{added.length ? `סיום · נוספו ${added.length} ל${label} · ${sum(added).kcal} קק״ל` : 'סיום'}</button>
      )}
    </Modal>
  );
}

// A usual thing: tap adds it, tap again takes it out. Saved meals carry a small star.
function Pick({ name, detail, kcal, on, saved, onClick }: { name: string; detail?: string; kcal?: number; on: boolean; saved?: boolean; onClick: () => void }) {
  return (
    <button className={`row pick${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      <div className="grow">
        <div>{saved && <><Star /><span className="sr-only">ארוחה שמורה: </span></>}{name}</div>
        {detail && <small className="muted">{detail}</small>}
      </div>
      {kcal != null && <span className="kcal">{kcal}</span>}
      <span className="mark" aria-hidden>{on ? <Check /> : <Plus />}</span>
    </button>
  );
}
const Plus = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
const Check = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const Star = () => <svg className="star" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>;

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
  const real = ctx.foods.find((x) => x.id === entry.foodId);
  const food = useMemo(() => itemFood(ctx.foods, entry as Item), [ctx.foods, entry]);
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
      <Amount food={food} init={itemInit(entry as Item)} onPick={save} cta="שמור"
        onAddUnit={real ? unitSaver(ctx, real) : undefined} />
      <button className="btn danger" onClick={onDelete}>מחק</button>
    </Modal>
  );
}
