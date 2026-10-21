import { useEffect, useState } from 'react';
import type { Ctx } from './App';
import { MEALS, pickItem, addDays, addEntries, amountLabel, client, fmtDate, loadEntries, mealNow, sum, today, type Entry, type MealKey } from './lib';
import { MacroLegend, MicroLine, Ring } from './ui';
import { AddDialog, EntryDialog } from './AddDialog';
import { Icon } from './icons';

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
  const [toggled, setToggled] = useState<Record<string, boolean>>({}); // `${date}:${meal}` → open

  useEffect(() => {
    setEntries(null);
    loadEntries(date, date).then(setEntries);
  }, [date]);

  const list = entries ?? [];
  const tot = sum(list);
  const goal = ctx.profile?.kcal ?? 0;

  // Today, meals before the current one start collapsed; a tap on the header overrides.
  const isOpen = (meal: MealKey) => toggled[`${date}:${meal}`] ?? !(date === today() && MEALS.findIndex((m) => m.key === meal) < MEALS.findIndex((m) => m.key === mealNow()));
  const setOpen = (meal: string, open: boolean) => setToggled((t) => ({ ...t, [`${date}:${meal}`]: open }));
  const added = (es: Entry[]) => {
    setEntries((cur) => [...(cur ?? []), ...es]);
    if (es[0]) setOpen(es[0].meal, true);
  };
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
      <header className="datebar">
        <button className="icon" onClick={() => setDate(addDays(date, -1))} aria-label="יום קודם"><Icon name="chevron-right" /></button>
        <label className="date-pick">
          <b>{date === today() ? 'היום' : fmtDate(date, { weekday: 'long' })}</b>
          <span className="muted">{fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <button className="icon" onClick={() => setDate(addDays(date, 1))} aria-label="יום הבא"><Icon name="chevron-left" /></button>
        {date !== today() && <button className="btn small" onClick={() => setDate(today())}>להיום</button>}
      </header>

      <section className="card summary" aria-label="סיכום היום">
        <Ring value={tot.kcal} goal={goal} center={<><b>{goal ? Math.abs(Math.round(goal - tot.kcal)) : tot.kcal}</b><small>{goal ? (goal - tot.kcal >= 0 ? 'נותרו' : 'חריגה') : 'קלוריות'}</small></>} />
        <div className="grow">
          <div className="kcal-line"><span>נצרכו</span><b>{tot.kcal}</b><span className="muted">מתוך {goal} קק״ל</span></div>
          <MacroLegend n={tot} goals={ctx.profile ?? undefined} />
          <MicroLine n={tot} rda />
        </div>
      </section>

      {/* One way in, always in reach: the meal starts at the time of day's and is one tap to change in the window */}
      <button className="fab" onClick={() => setAdding(mealNow())}><Icon name="plus" />הוספה</button>

      {msg && <div className="banner" onClick={() => setMsg('')}>{msg}</div>}
      {undo && <div className="toast">״{undo.name}״ נמחק <button onClick={() => restore(undo)}>בטל</button></div>}
      {entries === null && <div className="muted center">טוען…</div>}

      <section className="meals" aria-labelledby="meals-title">
      <h2 id="meals-title" className="eyebrow">ארוחות</h2>
      <div className="card">
      {MEALS.map((m) => {
        const es = list.filter((e) => e.meal === m.key);
        const open = isOpen(m.key);
        return (
          <section key={m.key} className="meal" aria-label={m.label}>
            <header>
              <h3 className="grow">
                <button className="meal-toggle" aria-expanded={open} aria-controls={`meal-${m.key}`} onClick={() => setOpen(m.key, !open)}>
                  <span className="meal-icon"><Icon name={m.icon} /></span>{m.label}<span className="grow" />
                  <b>{sum(es).kcal}</b><small className="muted">קק״ל</small><span className="chev"><Icon name="chevron-down" /></span>
                </button>
              </h3>
            </header>
            <div id={`meal-${m.key}`} hidden={!open}>
              {es.map((e) => (
                <div key={e.id} className="row" role="button" tabIndex={0} onClick={() => setEditing(e)}>
                  <div className="grow"><div>{e.name}</div><small className="muted">{amountLabel(e)}</small></div>
                  <b>{e.kcal}</b>
                  <button className="icon del" aria-label={`מחק: ${e.name}`} onClick={(ev) => { ev.stopPropagation(); remove(e); }}><Icon name="x" /></button>
                </div>
              ))}
              {es.length ? <footer><button onClick={() => saveMeal(m.key)}><Icon name="star" />שמור כארוחה</button></footer> : <p className="empty">עוד לא נרשם כלום</p>}
            </div>
          </section>
        );
      })}
      </div>
      </section>

      <div className="day-actions">
        <button className="btn" onClick={onExport}><Icon name="download" />ייצוא CSV / PDF</button>
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


