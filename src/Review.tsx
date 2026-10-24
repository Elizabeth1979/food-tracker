import { useId, useState } from 'react';
import type { Ctx } from './App';
import { GRAMS, itemFor, matchFoods, parseLine, searchFoods, splitAnd, sum, unitFor, unitsOf, type Food, type Item, type Parsed, type Unit } from './lib';
import { Modal, Why } from './ui';
import { FoodForm } from './Foods';
import { NutLine } from './AddDialog';
import { Icon } from './icons';
import { ArticleLink } from './Guide';

// `q` set: the row is searching the whole database for a different food (the match or the photo got it wrong).
type Row = { id: number; p: Parsed; options: Food[]; food: Food | null; qty: string; unit: Unit; q?: string };

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
  const why = useId();
  // Something the photo missed: typed like a meal line ("2 פיתות, טחינה"), matched the same way, added as rows.
  // `food`: picked from the list under the field for the last item typed.
  const addMore = (food?: Food) => {
    const next = Math.max(-1, ...rows.map((r) => r.id)) + 1;
    const ps = splitAnd(ctx.foods, parseLine(more), ctx.recent);
    setRows([...rows, ...ps.map((p, i) => rowFor(ctx, p, next + i, i === ps.length - 1 ? food : undefined))]);
    setMore('');
  };
  const set = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const pick = (r: Row, f: Food) => { const a = unitFor(f, r.p); set(r.id, { food: f, qty: String(a.qty), unit: a.unit, q: undefined, options: [f, ...r.options.filter((o) => o.id !== f.id)] }); };
  const choose = (r: Row, v: string) => (v === '+' ? setCreating(r) : v === '?' ? set(r.id, { q: '' }) : pick(r, r.options.find((f) => f.id === v)!));

  const items = rows.flatMap((r) => (r.food ? [itemFor(r.food, Number(r.qty) || 0, r.unit)] : [])).filter((it) => it.grams > 0);
  const missing = rows.filter((r) => !r.food).length;

  if (creating)
    return (
      <Modal title="מזון חדש" onClose={() => setCreating(null)}>
        <FoodForm foods={ctx.foods} init={{ name: creating.p.query }} onSaved={(f) => {
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
              <button className="icon del" aria-label={`הסר: ${r.p.text}`} onClick={() => setRows(rows.filter((x) => x.id !== r.id))}><Icon name="x" /></button>
            </div>
            {r.p.hidden && <>
              <p className="muted small">ניחוש: שמן או רוטב שלא רואים בתמונה. היה? תקנו את הכמות. לא היה? הסירו.</p>
              <ArticleLink slug="4-photos">למה תמונה מפספסת שמן?</ArticleLink>
            </>}
            {r.q !== undefined ? (
              <div className="form">
                <div className="amount-row">
                  <input type="search" autoFocus aria-label="חיפוש מזון אחר" placeholder="חיפוש מזון…" value={r.q} onChange={(e) => set(r.id, { q: e.target.value })} />
                  <button className="btn" onClick={() => set(r.id, { q: undefined })}>ביטול</button>
                </div>
                <FoodHits ctx={ctx} q={r.q} onPick={(f) => pick(r, f)} />
              </div>
            ) : r.options.length ? (
              <select value={r.food?.id} aria-label="מזון" onChange={(e) => choose(r, e.target.value)}>
                {r.options.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                <option value="?">חיפוש מזון אחר…</option>
                <option value="+">＋ מזון חדש: {r.p.query}</option>
              </select>
            ) : (
              <div className="amount-row">
                <span className="grow warn-text">לא נמצא ״{r.p.query}״</span>
                <button className="btn small" onClick={() => set(r.id, { q: '' })}>חיפוש</button>
                <button className="btn small" onClick={() => setCreating(r)}><Icon name="plus" />צור מזון</button>
              </div>
            )}
            {r.food && r.q === undefined && (
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
      <FoodHits ctx={ctx} q={parseLine(more).at(-1)?.query ?? ''} onPick={addMore} />
      {items.length > 0 && <NutLine n={sum(items)} />}
      {missing > 0 && <p className="muted small">{missing === 1 ? 'פריט אחד בלי התאמה לא יתווסף.' : `${missing} פריטים בלי התאמה לא יתווספו.`}</p>}
      <button className="btn primary" disabled={!items.length} aria-describedby={items.length ? undefined : why} onClick={() => onAdd(items)}>{cta} ({items.length})</button>
      {!items.length && <Why id={why}>אין עדיין מזון עם כמות להוספה</Why>}
    </div>
  );
}

// Up to five foods matching a typed name, each a button that picks it.
function FoodHits({ ctx, q, onPick }: { ctx: Ctx; q: string; onPick: (f: Food) => void }) {
  return <>{q.trim() && searchFoods(ctx.foods, q, ctx.recent).slice(0, 5).map((f) => <button key={f.id} type="button" className="row" onClick={() => onPick(f)}>{f.name}</button>)}</>;
}
