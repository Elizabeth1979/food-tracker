import { useState } from 'react';
import type { Ctx } from './App';
import { GRAMS, itemFor, matchFoods, parseLine, splitAnd, sum, unitFor, unitsOf, type Food, type Item, type Parsed, type Unit } from './lib';
import { Modal } from './ui';
import { FoodForm } from './Foods';
import { NutLine } from './AddDialog';

type Row = { id: number; p: Parsed; options: Food[]; food: Food | null; qty: string; unit: Unit };

const rowFor = (ctx: Ctx, p: Parsed, id: number, food?: Food): Row => {
  const options = food ? [food] : matchFoods(ctx.foods, p.query, ctx.recent).slice(0, 8);
  const f = options[0] ?? null;
  const a = f ? unitFor(f, p) : { qty: p.qty ?? 1, unit: { n: GRAMS, g: 1 } };
  return { id, p, options, food: f, qty: String(a.qty), unit: a.unit };
};

// The foods a line of text (or a photo) turned into: each matched to a database food with an amount, all editable,
// then added together. Rows without a match can become a new food on the spot.
export function ReviewList({ ctx, parsed, cta, onAdd }: { ctx: Ctx; parsed: Parsed[]; cta: string; onAdd: (items: Item[]) => void }) {
  const [rows, setRows] = useState<Row[]>(() => splitAnd(ctx.foods, parsed, ctx.recent).map((p, i) => rowFor(ctx, p, i)));
  const [creating, setCreating] = useState<Row | null>(null);
  const [more, setMore] = useState('');
  // Something the photo missed: typed like a meal line ("2 פיתות, טחינה"), matched the same way, added as rows.
  const addMore = () => {
    const next = Math.max(-1, ...rows.map((r) => r.id)) + 1;
    setRows([...rows, ...splitAnd(ctx.foods, parseLine(more), ctx.recent).map((p, i) => rowFor(ctx, p, next + i))]);
    setMore('');
  };
  const set = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const pick = (r: Row, f: Food) => { const a = unitFor(f, r.p); set(r.id, { food: f, qty: String(a.qty), unit: a.unit }); };

  const items = rows.flatMap((r) => (r.food ? [itemFor(r.food, Number(r.qty) || 0, r.unit)] : [])).filter((it) => it.grams > 0);
  const missing = rows.filter((r) => !r.food).length;

  if (creating)
    return (
      <Modal title="מזון חדש" onClose={() => setCreating(null)}>
        <FoodForm init={{ name: creating.p.query }} onSaved={(f) => {
          ctx.setFoods([...ctx.foods, f]);
          setRows((rs) => rs.map((r) => (r.id === creating.id ? { ...rowFor(ctx, r.p, r.id, f), options: [f, ...r.options] } : r)));
          setCreating(null);
        }} />
      </Modal>
    );
  return (
    <div className="review">
      {!rows.length && <p className="muted">לא זוהו מזונות. נסו לכתוב למשל ״2 ביצים, פרוסת לחם״.</p>}
      {rows.map((r) => {
        const units = r.food ? unitsOf(r.food) : [];
        if (r.food && !units.some((u) => u.n === r.unit.n)) units.push(r.unit); // a typical size the food doesn't list ("פרוסה" of apple)
        const it = r.food && itemFor(r.food, Number(r.qty) || 0, r.unit);
        return (
          <div key={r.id} className="review-row">
            <div className="amount-row">
              <small className="muted grow">״{r.p.text}״</small>
              <button className="icon del" aria-label="הסר" onClick={() => setRows(rows.filter((x) => x.id !== r.id))}>✕</button>
            </div>
            {r.options.length ? (
              <select value={r.food?.id} aria-label="מזון" onChange={(e) => (e.target.value === '+' ? setCreating(r) : pick(r, r.options.find((f) => f.id === e.target.value)!))}>
                {r.options.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                <option value="+">＋ מזון חדש: {r.p.query}</option>
              </select>
            ) : (
              <div className="amount-row">
                <span className="grow warn-text">לא נמצא ״{r.p.query}״</span>
                <button className="btn small" onClick={() => setCreating(r)}>＋ צור מזון</button>
              </div>
            )}
            {r.food && (
              <div className="amount-row">
                <input type="number" inputMode="decimal" min="0" step="any" aria-label="כמות" value={r.qty} onChange={(e) => set(r.id, { qty: e.target.value })} />
                <select value={r.unit.n} aria-label="יחידה" onChange={(e) => { const u = units.find((x) => x.n === e.target.value)!; set(r.id, { unit: u, qty: u.g === 1 ? String(r.food!.servingG) : '1' }); }}>
                  {units.map((u) => <option key={u.n} value={u.n}>{u.g === 1 ? u.n : `${u.n} (${u.g} ג׳)`}</option>)}
                </select>
                <b className="nowrap">{it!.kcal} קק״ל</b>
              </div>
            )}
          </div>
        );
      })}
      <form className="amount-row" onSubmit={(e) => { e.preventDefault(); if (more.trim()) addMore(); }}>
        <input aria-label="הוספת מזון לרשימה" placeholder="שכחתי משהו? למשל: פיתה, 2 כפות טחינה" value={more} onChange={(e) => setMore(e.target.value)} />
        <button className="btn" disabled={!more.trim()}>הוסף</button>
      </form>
      {items.length > 0 && <NutLine n={sum(items)} />}
      {missing > 0 && <p className="muted small">{missing === 1 ? 'פריט אחד בלי התאמה לא יתווסף.' : `${missing} פריטים בלי התאמה לא יתווספו.`}</p>}
      <button className="btn primary" disabled={!items.length} onClick={() => onAdd(items)}>{cta} ({items.length})</button>
    </div>
  );
}
