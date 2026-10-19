import { useEffect, useState } from 'react';
import type { Ctx } from './App';
import { MEALS, pickItem, addDays, addEntries, amountLabel, client, fmtDate, loadEntries, mealNow, sum, today, type Entry, type MealKey } from './lib';
import { Donut, MacroLegend, MicroLine } from './ui';
import { AddDialog, EntryDialog } from './AddDialog';

export default function Day({ ctx, date, setDate, onExport }: { ctx: Ctx; date: string; setDate: (d: string) => void; onExport: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  // Home-screen shortcuts open straight into the add dialog: /?add=breakfast|lunch|dinner|snack|saved
  const [shortcut] = useState(() => {
    const add = new URLSearchParams(location.search).get('add');
    if (add) history.replaceState(null, '', '/');
    return add;
  });
  const [adding, setAdding] = useState<MealKey | null>(() => (shortcut ? (MEALS.some((m) => m.key === shortcut) ? (shortcut as MealKey) : mealNow()) : null));
  const [editing, setEditing] = useState<Entry | null>(null);
  const [msg, setMsg] = useState('');
  const [undo, setUndo] = useState<Entry | null>(null);

  useEffect(() => {
    setEntries(null);
    loadEntries(date, date).then(setEntries);
  }, [date]);

  const list = entries ?? [];
  const tot = sum(list);
  const goal = ctx.profile?.kcal ?? 0;

  const added = (es: Entry[]) => setEntries((cur) => [...(cur ?? []), ...es]);
  const remove = async (e: Entry) => {
    await client.models.Entry.delete({ id: e.id });
    setEntries((cur) => cur!.filter((x) => x.id !== e.id));
    setUndo(e);
    setTimeout(() => setUndo((u) => (u?.id === e.id ? null : u)), 6000);
  };
  const restore = async (e: Entry) => {
    setUndo(null);
    added(await addEntries(e.date, e.meal as MealKey, [pickItem(e)]));
  };
  const saveMeal = async (meal: MealKey) => {
    const items = list.filter((e) => e.meal === meal).map(pickItem);
    const name = items.length && prompt('שם לארוחה השמורה:');
    if (!name) return;
    const { data } = await client.models.SavedMeal.create({ name, items: JSON.stringify(items) });
    ctx.setMeals([...ctx.meals, data!]);
    setMsg(`"${name}" נשמרה`);
  };

  return (
    <div className="day">
      <div className="datebar card">
        <button className="icon" onClick={() => setDate(addDays(date, -1))} aria-label="יום קודם"><Chevron right /></button>
        <label className="date-pick">
          <b>{date === today() ? 'היום' : fmtDate(date, { weekday: 'long' })}</b>
          <span className="muted">{fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <button className="icon" onClick={() => setDate(addDays(date, 1))} aria-label="יום הבא"><Chevron /></button>
        {date !== today() && <button className="btn small" onClick={() => setDate(today())}>להיום</button>}
      </div>

      <section className="card summary">
        <Donut n={tot} center={<><b>{goal ? Math.round(goal - tot.kcal) : tot.kcal}</b><small>{goal ? (goal - tot.kcal >= 0 ? 'נותרו' : 'חריגה') : 'קלוריות'}</small></>} />
        <div className="grow">
          <div className="kcal-line"><span>נצרכו</span><b>{tot.kcal}</b><span className="muted">/ {goal} קק״ל</span></div>
          <div className="bar big"><i style={{ width: `${goal ? Math.min(100, (tot.kcal / goal) * 100) : 0}%` }} className={tot.kcal > goal ? 'over' : ''} /></div>
          <MacroLegend n={tot} goals={ctx.profile ?? undefined} />
          <MicroLine n={tot} rda />
        </div>
      </section>

      {msg && <div className="banner" onClick={() => setMsg('')}>{msg}</div>}
      {undo && <div className="toast">״{undo.name}״ נמחק <button onClick={() => restore(undo)}>בטל</button></div>}
      {entries === null && <div className="muted center">טוען…</div>}

      {MEALS.map((m) => {
        const es = list.filter((e) => e.meal === m.key);
        return (
          <section key={m.key} className="card meal">
            <header>
              <span className="meal-icon">{m.icon}</span>
              <h3>{m.label}</h3>
              <span className="grow" />
              <b>{sum(es).kcal}</b><small className="muted">קק״ל</small>
              <button className="add" onClick={() => setAdding(m.key)} aria-label="הוסף">＋</button>
            </header>
            {es.map((e) => (
              <div key={e.id} className="row" role="button" tabIndex={0} onClick={() => setEditing(e)}>
                <div className="grow"><div>{e.name}</div><small className="accent">{amountLabel(e)}</small></div>
                <b>{e.kcal}</b>
                <button className="icon del" aria-label="מחק" onClick={(ev) => { ev.stopPropagation(); remove(e); }}>✕</button>
              </div>
            ))}
            {es.length > 0 && <footer><button onClick={() => saveMeal(m.key)}>☆ שמור כארוחה</button></footer>}
          </section>
        );
      })}

      <div className="day-actions">
        <button className="btn" onClick={onExport}>⇩ ייצוא CSV / PDF</button>
      </div>

      {adding && <AddDialog ctx={ctx} meal={adding} date={date} onClose={() => setAdding(null)} onAdded={added}
        onRemoved={(es) => setEntries((cur) => cur!.filter((x) => !es.some((e) => e.id === x.id)))} />}
      {editing && (
        <EntryDialog ctx={ctx} entry={editing} onClose={() => setEditing(null)} onDelete={() => { remove(editing); setEditing(null); }}
          onSaved={(e) => { setEntries((cur) => cur!.map((x) => (x.id === e.id ? e : x))); setEditing(null); }} />
      )}
    </div>
  );
}

// SVG so RTL bidi mirroring can't flip it; in RTL the previous day sits on the right, pointing right.
const Chevron = ({ right }: { right?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={right ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
  </svg>
);

