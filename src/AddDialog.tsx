import { useEffect, useId, useMemo, useState } from 'react';
import type { Ctx } from './App';
import { GRAMS, MEALS, addDays, addEntries, addUnit, json, amountLabel, client, fmtDate, itemFor, loadEntries, parseLine, pickItem, readLabel, readPhoto, savePhoto, scale, searchFoods, sum, today, unitsOf, type Entry, type Food, type Item, type MealKey, type MealPhoto, type Nut, type Parsed, type SavedMeal, type Unit } from './lib';
import { norm } from './search';
import { FileButton, FoodSummary, Modal, PhotoPick, UNIT_HINT, UnitInputs, Why, unitOf, usePhotoUrl, type UnitDraft } from './ui';
import { FoodForm, labelFood } from './Foods';
import { ReviewList } from './Review';
import { Icon } from './icons';

// Calories and macros only: vitamins are for looking closer (a food's details, the day's summary), not for adding.
export const NutLine = ({ n }: { n: Nut }) => (
  <div className="nutline"><b>{n.kcal} קק״ל</b><span>פחמימות {n.carbs} ג׳</span><span>שומן {n.fat} ג׳</span><span>חלבון {n.protein} ג׳</span></div>
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
  const why = useId();
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
          <button className="icon" aria-label="ביטול" onClick={() => setNewUnit(null)}><Icon name="x" /></button>
        </div>
      )}
      <NutLine n={it} />
      <button className="btn primary" disabled={!it.grams} aria-describedby={it.grams ? undefined : why} onClick={() => onPick(it)}>{cta}</button>
      {!it.grams && <Why id={why}>כתבו כמות גדולה מאפס כדי להוסיף</Why>}
    </div>
  );
}

// Saves a new unit on the food and swaps the updated food into ctx.foods.
export const unitSaver = (ctx: Ctx, f: Food, then?: (f: Food) => void) => async (u: Unit) => {
  const nf = await addUnit(f, u);
  ctx.setFoods(ctx.foods.map((x) => (x.id === nf.id ? nf : x)));
  then?.(nf);
};

// Opens on what you usually eat, saved meals and single foods, each at the amount you had last time.
// One tap on ＋ adds, a second takes it back out, and the dialog stays open until "סיום", so a whole meal is a few taps.
// Tapping a food's name opens the amount picker on last time's amount, for a different amount this time.
// Search, typing and photos are for the less usual things; those go through the amount picker.
// No meal buttons: what's added goes to the meal of the time of day (the owner doesn't care which), and an entry
// can still be moved to another meal from the diary. The phone's back button (or Esc) steps back from the amount
// or typing view to the list, and from the list closes it.
// A nutrition label goes straight in: photo, check the name and values, then the amount; the full form only on "עריכה".
// `fromFoods` (a food tapped in the מזונות page) keeps that page's own look: "חזרה לחיפוש", 100 g.
export function AddDialog({ ctx, meal: meal0, date, fromFoods, onClose, onAdded, onRemoved, onPhoto, initial }: { ctx: Ctx; meal: MealKey; date: string; fromFoods?: boolean; onClose: () => void; onAdded: (e: Entry[]) => void; onRemoved?: (e: Entry[]) => void; onPhoto?: (p: MealPhoto) => void; initial?: Food }) {
  const meal = meal0;
  const [q, setQ] = useState('');
  const [writing, setWriting] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null); // taken from the list screen: goes straight to recognition
  const [sel, setSel] = useState<Food | null>(initial ?? null);
  const [creating, setCreating] = useState<Partial<Food> | null>(null); // the full new-food form, with what's known
  const [labelShot, setLabelShot] = useState<File | null>(null); // a label photo being read
  const [checking, setChecking] = useState<Partial<Food> | null>(null); // a read label, to check before logging
  const [err, setErr] = useState('');
  const uid = useId();
  const [busy, setBusy] = useState(false);
  // What this visit added, keyed by the row that added it ("m:<saved meal>", "f:<food>", or one-off keys).
  const [done, setDone] = useState<Record<string, Entry[]>>({});
  // The past month, loaded once: the last amount of each food, and what you tend to have at each meal.
  const [month, setMonth] = useState<Entry[]>([]);
  useEffect(() => { loadEntries(addDays(date, -30), date).then(setMonth); }, [date]);
  const added = Object.values(done).flat();
  // This visit's additions count as the latest, so a row added at another amount shows that amount.
  const last = useMemo(() => {
    const m: Record<string, Entry> = {};
    for (const e of [...month].sort((a, b) => a.date.localeCompare(b.date)).concat(added)) if (e.foodId) m[e.foodId] = e;
    return m;
  }, [month, done]);
  const hits = useMemo(() => searchFoods(ctx.foods, q, ctx.recent), [ctx.foods, q, ctx.recent]);
  const meals = q ? ctx.meals.filter((m) => norm(m.name).includes(norm(q))) : ctx.meals;
  // Order fixed when the dialog opens: adding moves a food up in "recent", and rows mustn't jump under your finger.
  const [order] = useState(ctx.recent);
  // Saved meals and single foods in one list, by how often you've had them this past month, at any meal, then by
  // the most recent. A food counts each time it was logged; a saved meal each meal that had all of its foods.
  // The same list whatever the meal: the owner wants it to stay put, with what she logs most at the top.
  const usual = useMemo(() => {
    const n: Record<string, number> = {};
    const had: Record<string, Set<string>> = {}; // the foods of each meal eaten: "<date>|<meal>"
    for (const e of month) if (e.foodId) {
      n[e.foodId] = (n[e.foodId] ?? 0) + 1;
      (had[`${e.date}|${e.meal}`] ??= new Set()).add(e.foodId);
    }
    const byScore = <T extends { score: number }>(xs: T[]) => xs.sort((a, b) => b.score - a.score); // stable: ties stay most recent first
    const foods = byScore(searchFoods(ctx.foods, '', order).map((f) => ({ key: `f:${f.id}`, f, score: n[f.id] ?? 0 }))).slice(0, USUAL_MAX);
    const saved = ctx.meals.map((m) => {
      const items = json<Item[]>(m.items, []);
      const ids = items.flatMap((it) => (it.foodId ? [it.foodId] : []));
      const score = ids.length ? Object.values(had).filter((s) => ids.every((id) => s.has(id))).length : 0;
      return { key: `m:${m.id}`, m, items, score };
    });
    return byScore([...foods, ...saved]);
  }, [ctx.foods, ctx.meals, order, month]);
  const [more, setMore] = useState(false);
  const day = date === today() ? '' : ` · ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}`;

  const add = async (key: string, items: Item[]) => {
    setBusy(true);
    try {
      ctx.addRecent(items.flatMap((i) => (i.foodId ? [i.foodId] : [])));
      const es = await addEntries(date, meal, items);
      onAdded(es);
      setDone((d) => ({ ...d, [key]: [...(d[key] ?? []), ...es] }));
    } finally { setBusy(false); }
    if (initial) onClose(); // opened on one food from the מזונות tab
    setSel(null); setWriting(false); setPhoto(null); setQ('');
  };
  const readShot = async (file: File) => {
    setErr(''); setLabelShot(file);
    try { setChecking(labelFood(await readLabel(file))); } catch (x: any) { setErr(x.message); } finally { setLabelShot(null); }
  };
  const created = (f: Food) => { ctx.setFoods([...ctx.foods, f]); setCreating(null); setChecking(null); setSel(f); };
  const saveLabel = async (f: Partial<Food>) => {
    const { data, errors } = await client.models.Food.create({ ...f, source: 'user' } as Food);
    if (errors) return setErr(errors[0].message);
    created(data!);
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

  const mealPick = (r: { key: string; m: SavedMeal; items: Item[] }) => <Pick key={r.key} saved on={!!done[r.key]} name={r.m.name} detail={r.items.map((i) => i.name.split(',')[0]).join(' · ')}
    kcal={sum(r.items).kcal} onClick={() => toggle(r.key, () => r.items)} />;
  const foodPick = (r: { key: string; f: Food }) => {
    const e = last[r.f.id];
    return <Pick key={r.key} on={!!done[r.key]} name={r.f.name} detail={e ? amountLabel(e) : undefined}
      kcal={e?.kcal} onClick={() => toggle(r.key, () => (e ? [pickItem(e)] : null), r.f)} onOpen={() => !busy && setSel(r.f)} />;
  };

  if (creating)
    return (
      <Modal title="מזון חדש" onClose={() => setCreating(null)}>
        <FoodForm init={creating} onSaved={created} />
      </Modal>
    );
  return (
    <Modal title={`הוספה ליומן${day}`} onClose={onClose}
      onBack={() => { if (sel && !initial) { setSel(null); return true; } if (writing) { setWriting(false); setPhoto(null); return true; } if (checking) { setChecking(null); return true; } return false; }}>
      {sel ? (
        <div className="picked">
          {fromFoods && <button className="link" onClick={() => setSel(null)}><Icon name="arrow-right" />חזרה לחיפוש</button>}
          <h3>{sel.name}</h3>
          <Amount key={`${sel.id}:${fromFoods ? '' : last[sel.id]?.id ?? ''}`} food={sel} init={fromFoods ? undefined : last[sel.id] && itemInit(last[sel.id] as Item)} onPick={(it) => add(`f:${sel.id}`, [it])} cta="הוסף" onAddUnit={unitSaver(ctx, sel, setSel)} />
        </div>
      ) : checking ? (
        <LabelCheck food={checking} onSave={saveLabel} onEdit={(f) => setCreating(f)} />
      ) : writing ? (
        <>
          <TextOrPhoto ctx={ctx} file={photo} cta="הוסף" onAdd={(items, shot) => {
            add(`w:${Date.now()}`, items);
            if (shot) void savePhoto(shot, date, meal).then(onPhoto); // a failure shows in the app's error banner
          }} />
        </>
      ) : (
        <>
          <input className="search" type="search" aria-label="חיפוש" placeholder="חיפוש מזון…" value={q} onChange={(e) => setQ(e.target.value)} />
          {/* The other ways in, big and up front: a meal photo (camera or gallery), typing the meal, or a package's
              nutrition label (the camera opens at once; the label becomes a food of your own, then you log it) */}
          {!q && <>
            <PhotoPick camera="צילום" gallery="מהגלריה" className="btn big-choice" reading={labelShot} busyText="קורא את התווית…" onFile={(f) => { setPhoto(f); setWriting(true); }}>
              <button className="btn big-choice" onClick={() => setWriting(true)}><Icon name="pencil" />כתיבה</button>
              <FileButton camera className="btn big-choice" onFile={readShot}><Icon name="tag" />תווית</FileButton>
            </PhotoPick>
            {err && <p className="error" role="alert">{err}</p>}
          </>}
          <div className="usual">
            {q ? meals.map((m) => mealPick({ key: `m:${m.id}`, m, items: json<Item[]>(m.items, []) })) : <>
              {/* Your usual things, one tap each with last time's amount; ignore them and search, photograph or type instead */}
              {usual.length > 0 && (
                <section aria-labelledby={`${uid}-u`}>
                  <h3 id={`${uid}-u`}>הרגילים שלך</h3>
                  <p className="muted small">לחיצה על ＋ מוסיפה בכמות של הפעם הקודמת. לכמות אחרת, לחצו על השם. <Icon name="utensils" /> ארוחה שמורה.</p>
                  {(more ? usual : usual.slice(0, USUAL_SHOWN)).map((r) => ('m' in r ? mealPick(r) : foodPick(r)))}
                  {!more && usual.length > USUAL_SHOWN && <button className="link" onClick={() => setMore(true)}>עוד {usual.length - USUAL_SHOWN}</button>}
                </section>
              )}
            </>}
            {q && hits.map((f) => (
              <button key={f.id} className="row" onClick={() => setSel(f)}>
                <div className="grow"><div>{f.name}</div><FoodSummary f={f} /></div>
              </button>
            ))}
            {!q && !usual.length && <p className="muted">מה שתרשמו יופיע כאן בפעם הבאה, להוספה בלחיצה אחת.</p>}
            {q && <button className="row muted" onClick={() => setCreating({ name: q })}><Icon name="plus" />מזון חדש: ״{q}״</button>}
          </div>
        </>
      )}
      {/* Always there, so the sheet doesn't grow and shift the rows on the first tap. */}
      {!sel && !writing && !checking && (
        <button className="btn primary done" onClick={onClose}>{added.length ? `סיום · נוספו ${added.length} · ${sum(added).kcal} קק״ל` : 'סיום'}</button>
      )}
    </Modal>
  );
}

const USUAL_SHOWN = 10;
const USUAL_MAX = 30; // single foods behind "עוד"; saved meals are all there

// A nutrition label just read: the product's name and values to check against the package, then on to the amount.
// "עריכה" opens the full form with everything filled in (vitamins, units), for what the label got wrong.
function LabelCheck({ food, onSave, onEdit }: { food: Partial<Food>; onSave: (f: Partial<Food>) => void; onEdit: (f: Partial<Food>) => void }) {
  const [name, setName] = useState(food.name ?? '');
  const why = useId();
  const unit = json<Unit[]>(food.units, [])[0];
  const per = food.servingG === 100 ? '100 גרם' : unit ? `${unit.n} אחת` : `${food.servingG} גרם`;
  return (
    <div className="form">
      <p className="muted small" role="status">נקרא מהתווית. כדאי לבדוק מול האריזה.</p>
      <label><span>שם המוצר</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <p className="muted small">הערכים ל{per}:</p>
      <NutLine n={food as Nut} />
      <div className="grid2">
        <button className="btn" onClick={() => onEdit({ ...food, name })}><Icon name="pencil" />עריכה</button>
        <button className="btn primary" disabled={!name.trim()} aria-describedby={name.trim() ? undefined : why} onClick={() => onSave({ ...food, name: name.trim() })}>המשך</button>
      </div>
      {!name.trim() && <Why id={why}>כתבו את שם המוצר כדי להמשיך</Why>}
    </div>
  );
}

// Which meal an entry goes to: four tabs, the chosen one pressed.
const MealSeg = ({ meal, onChange }: { meal: MealKey; onChange: (m: MealKey) => void }) => (
  <div className="seg" role="group" aria-label="ארוחה">
    {MEALS.map((m) => <button key={m.key} className={meal === m.key ? 'on' : ''} aria-pressed={meal === m.key} onClick={() => onChange(m.key)}><Icon name={m.icon} />{m.short}</button>)}
  </div>
);

// A usual thing: tap adds it, tap again takes it out. With onOpen, only ＋ does that, and the name opens the amount picker.
// A saved meal is marked with the utensils icon, named for screen readers too.
function Pick({ name, detail, kcal, on, saved, onClick, onOpen }: { name: string; detail?: string; kcal?: number; on: boolean; saved?: boolean; onClick: () => void; onOpen?: () => void }) {
  const body = <>
    <div className="grow">
      <div>{saved && <Icon name="utensils" />}{name}{saved && <span className="sr-only"> (ארוחה שמורה)</span>}</div>
      {detail && <small className="muted">{detail}</small>}
    </div>
    {kcal != null && <span className="kcal">{kcal}</span>}
  </>;
  const mark = <span className="mark"><Icon name={on ? 'check' : 'plus'} /></span>;
  if (!onOpen) return <button className={`row pick${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>{body}{mark}</button>;
  return (
    <div className={`row static pick${on ? ' on' : ''}`}>
      <button className="grow" onClick={onOpen}>{body}</button>
      <button className="icon" aria-label={`הוסף: ${name}`} aria-pressed={on} onClick={onClick}>{mark}</button>
    </div>
  );
}

// The picked photo with a note for what a photo can't tell (the cheese, the pasta, what's inside), then read.
function PhotoNote({ file, note, setNote, onRead, onCancel }: { file: File; note: string; setNote: (s: string) => void; onRead: () => void; onCancel: () => void }) {
  const src = usePhotoUrl(file);
  return (
    <div className="form">
      <figure className="reading">{src && <img src={src} alt="התמונה שנבחרה" />}</figure>
      <label>
        <span>הערה (לא חובה): מה לא רואים או קשה לזהות</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="גבינה בולגרית מגורדת, פסטה רגילה, כף שמן" />
      </label>
      <div className="grid2">
        <button className="btn" onClick={onCancel}>תמונה אחרת</button>
        <button className="btn primary" onClick={onRead}>זהה מזונות</button>
      </div>
    </div>
  );
}

// A whole meal in one go: typed ("יוגורט 150 גרם, 10 ענבים") or from a photo, then checked in a review list.
// `shot` is the photo the list came from, so it can be kept with the meal.
function TextOrPhoto({ ctx, file, cta, onAdd }: { ctx: Ctx; file?: File | null; cta: string; onAdd: (items: Item[], shot: File | null) => void }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Parsed[] | null>(null);
  const [reading, setReading] = useState<File | null>(null); // the photo being recognised
  const [shot, setShot] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const why = useId();
  const [picked, setPicked] = useState<File | null>(null); // a photo waiting for its note before it's read
  const [note, setNote] = useState('');
  const photo = async (file: File) => {
    setErr(''); setPicked(null); setReading(file);
    try { setParsed(await readPhoto(file, note || text)); setShot(file); } catch (x: any) { setErr(x.message); } finally { setReading(null); }
  };
  useEffect(() => { if (file) setPicked(file); }, [file]); // a photo taken on the list screen
  if (parsed)
    return (
      <>
        <ReviewList ctx={ctx} parsed={parsed} cta={cta} onAdd={(items) => onAdd(items, shot)} />
      </>
    );
  if (picked)
    return <PhotoNote file={picked} note={note} setNote={setNote} onRead={() => photo(picked)} onCancel={() => setPicked(null)} />;
  return (
    <div className="form">
      <PhotoPick camera="צילום" gallery="מהגלריה" reading={reading} busyText="מזהה מזונות בתמונה…" onFile={setPicked} />
      {/* Locked while a photo is being read, so it's clear that something is going on */}
      <fieldset className="form" disabled={!!reading}>
        <label>
          <span>מה אכלת? אפשר עם כמויות, מופרד בפסיקים</span>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="יוגורט 150 גרם, 10 ענבים, כף חמאת בוטנים, 2 כפות גרנולה" autoFocus={!file} />
        </label>
        <button className="btn primary" disabled={!text.trim()} aria-describedby={text.trim() && !reading ? undefined : why} onClick={() => setParsed(parseLine(text))}>המשך לבדיקה</button>
        {(reading || !text.trim()) && <Why id={why}>{reading ? 'אפשר להמשיך כשהזיהוי יסתיים' : 'כתבו מה אכלתם כדי להמשיך'}</Why>}
      </fieldset>
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
      <MealSeg meal={meal} onChange={setMeal} />
      <Amount food={food} init={itemInit(entry as Item)} onPick={save} cta="שמור"
        onAddUnit={real ? unitSaver(ctx, real) : undefined} />
      <button className="btn danger" onClick={onDelete}>מחק</button>
    </Modal>
  );
}
