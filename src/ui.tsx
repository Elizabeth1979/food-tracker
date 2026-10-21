import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { MACROS, MICROS, isFFQ, type Nut, type Unit } from './lib';
import { Icon } from './icons';

// A native modal <dialog>: the browser traps focus, closes it on Esc, and on Android closes it with the back
// button or gesture (close requests, Chrome 120+), so back no longer leaves the app. `onBack` gets that back
// press first and returns true when it handled it (going back one step inside the dialog) instead of closing.
export function Modal({ title, onClose, onBack, children }: { title: string; onClose: () => void; onBack?: () => boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!ref.current!.open) ref.current!.showModal(); }, []);
  return (
    <dialog ref={ref} className="modal" aria-label={title}
      onCancel={(e) => { e.preventDefault(); if (!onBack?.()) onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <header><h2>{title}</h2><button className="icon" onClick={onClose} aria-label="סגור"><Icon name="x" /></button></header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

// One button for a photo: without `capture`, the phone offers both the camera and the gallery.
// While `reading` (the photo being read) is set, it shows that photo dimmed under a spinner instead.
// Two ways in: Android's file picker no longer offers the camera, so the camera gets its own button (capture).
// `children` is one more choice in the same row (the add window's "כתיבה").
export function PhotoPick({ camera, gallery, reading, busyText = '', onFile, className = 'btn', children }: { camera: string; gallery: string; reading?: File | null; busyText?: string; onFile: (f: File) => void; className?: string; children?: ReactNode }) {
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  };
  if (reading) return <Reading file={reading} text={busyText} />;
  return (
    <div className={children ? 'grid3' : 'grid2'}>
      <label className={className}>
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} />
        <Icon name="camera" />{camera}
      </label>
      <label className={className}>
        <input type="file" accept="image/*" className="sr-only" onChange={pick} />
        <Icon name="image" />{gallery}
      </label>
      {children}
    </div>
  );
}

function Reading({ file, text }: { file: File; text: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => { const url = URL.createObjectURL(file); setSrc(url); return () => URL.revokeObjectURL(url); }, [file]);
  return (
    <figure className="reading" role="status">
      {src && <img src={src} alt="" />}
      <figcaption><span className="spinner" aria-hidden="true" /><b>{text}</b><span>זה לוקח כמה שניות</span></figcaption>
    </figure>
  );
}

// A titled part of a page: the title (and an optional action) above a card, as in the diary's "ארוחות".
export function Group({ title, action, body = 'pad', className, children }: { title: ReactNode; action?: ReactNode; body?: string; className?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={className} aria-labelledby={id}>
      <div className="group-head"><h2 id={id} className="eyebrow">{title}</h2>{action}</div>
      <div className={`card ${body}`}>{children}</div>
    </section>
  );
}

// Why a button is disabled, in readable text next to it (the button points here with aria-describedby).
export const Why = ({ id, children }: { id: string; children: ReactNode }) => <p className="why" id={id}><Icon name="info" />{children}</p>;

// Macro split by energy share (carbs/protein 4 kcal/g, fat 9 kcal/g).
export function macroShares(n: Nut) {
  const k = MACROS.map((m) => n[m.key] * m.kcalPerG);
  const t = k.reduce((a, b) => a + b, 0) || 1;
  return MACROS.map((m, i) => ({ ...m, g: n[m.key], pct: Math.round((k[i] / t) * 100), frac: k[i] / t }));
}

export function Donut({ n, size = 96, center }: { n: Nut; size?: number; center?: ReactNode }) {
  const shares = macroShares(n);
  const R = 42, C = 2 * Math.PI * R, gap = n.kcal ? 1.5 : 0;
  let off = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line)" strokeWidth="11" />
        {n.kcal > 0 && shares.map((s) => {
          const len = Math.max(0, s.frac * C - gap);
          const el = (
            <circle key={s.key} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="11"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 50 50)">
              <title>{`${s.label}: ${s.g} ג׳ (${s.pct}%)`}</title>
            </circle>
          );
          off += s.frac * C;
          return el;
        })}
      </svg>
      {center && <div className="donut-center">{center}</div>}
    </div>
  );
}

// Progress toward a goal: one accent arc, red once it's over.
export function Ring({ value, goal, size = 96, center }: { value: number; goal: number; size?: number; center?: ReactNode }) {
  const R = 44, C = 2 * Math.PI * R, f = goal ? Math.min(1, value / goal) : 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <circle className="ring-track" cx="50" cy="50" r={R} />
        {f > 0 && <circle className={value > goal ? 'ring-fill over' : 'ring-fill'} cx="50" cy="50" r={R} strokeDasharray={`${f * C} ${C}`} transform="rotate(-90 50 50)" />}
      </svg>
      {center && <div className="donut-center">{center}</div>}
    </div>
  );
}

export function MacroLegend({ n, goals }: { n: Nut; goals?: Partial<Record<'carbs' | 'fat' | 'protein', number | null>> }) {
  return (
    <div className="legend">
      {macroShares(n).map((s) => {
        const goal = goals?.[s.key];
        return (
          <div key={s.key} className="legend-row">
            <div className="legend-line">
              <span className="dot" style={{ background: s.color }} />
              <span className="grow">{s.label} <span className="muted">{s.pct}%</span></span>
              <span><b>{s.g}</b><span className="muted">{goal ? ` / ${goal}` : ''} ג׳</span></span>
            </div>
            {goal ? <div className="bar"><i style={{ width: `${Math.min(100, (s.g / goal) * 100)}%`, background: s.color }} /></div> : null}
          </div>
        );
      })}
    </div>
  );
}

// Micronutrients; values the food doesn't have are omitted, and so are zeros except in the day summary
// (`rda`), where "B12 0 / 2.4" is the point. `rda` shows B12 against its daily need.
export function MicroLine({ n, rda }: { n: Nut; rda?: boolean }) {
  const parts = MICROS.filter((m) => n[m.key] != null && (rda || n[m.key] !== 0)).map((m) => `${m.label} ${n[m.key]}${rda && 'rda' in m ? ` / ${m.rda}` : ''} ${m.unit}`);
  return parts.length ? <div className="micro muted">{parts.map((p) => <span key={p}>{p}</span>)}</div> : null;
}

// One-line nutrition summary for a food in lists: calories and macros for its serving size, in words.
// Micronutrients show once a food is picked (NutLine). Own foods and FFQ group averages get a tag.
export function FoodSummary({ f }: { f: Nut & { name: string; servingG: number; source?: string | null } }) {
  return (
    <small className="muted food-sum">
      {f.source !== 'moh' && <span className="tag">שלי</span>}
      {isFFQ(f) && <span className="tag warn" title="ממוצע של כמה מזונות משאלון תזונה, לא מזון מסוים">ממוצע כללי</span>}
      <span>ל־{f.servingG} ג׳: <b className="kcal">{f.kcal} קק״ל</b> · פחמימות {f.carbs} · שומן {f.fat} · חלבון {f.protein}</span>
    </small>
  );
}

// A unit as typed: "k of n weigh g grams". People know a package's weight and how many pieces are in it,
// rarely what one piece weighs, so the app divides. Saved as the weight of one.
export type UnitDraft = { k: string; n: string; g: string };
export const draftOf = (u: Unit): UnitDraft => ({ k: '1', n: u.n, g: String(u.g) });
export const unitOf = (d: UnitDraft): Unit => ({ n: d.n.trim(), g: Math.round((Number(d.g) / (Number(d.k) || 1)) * 100) / 100 });
export const UNIT_HINT = 'כמה יחידות שוקלות כמה גרם. לא יודעים כמה שוקלת אחת? כתבו את משקל האריזה וכמה יחידות יש בה, למשל 20 מסטיק = 28 ג׳, והמשקל של אחת יחושב לבד.';

export function UnitInputs({ d, set, autoFocus }: { d: UnitDraft; set: (d: UnitDraft) => void; autoFocus?: boolean }) {
  return (
    <>
      <input type="number" inputMode="decimal" min="0" step="any" className="unit-k" aria-label="כמה יחידות" value={d.k} onChange={(e) => set({ ...d, k: e.target.value })} />
      <input className="unit-n" placeholder="שם, למשל ״עדשה״" aria-label="שם היחידה" value={d.n} onChange={(e) => set({ ...d, n: e.target.value })} autoFocus={autoFocus} />
      <span aria-hidden="true">=</span>
      <input type="number" inputMode="decimal" min="0" step="any" className="unit-g" placeholder="גרם" aria-label="שוקלות יחד (גרם)" value={d.g} onChange={(e) => set({ ...d, g: e.target.value })} />
      <span className="muted">ג׳</span>
    </>
  );
}
