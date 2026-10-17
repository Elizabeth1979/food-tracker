import type { ReactNode } from 'react';
import { MACROS, MICROS, isFFQ, type Nut } from './lib';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header><h2>{title}</h2><button className="icon" onClick={onClose} aria-label="סגור">✕</button></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// Macro split by energy share (carbs/protein 4 kcal/g, fat 9 kcal/g).
export function macroShares(n: Nut) {
  const k = MACROS.map((m) => n[m.key] * m.kcalPerG);
  const t = k.reduce((a, b) => a + b, 0) || 1;
  return MACROS.map((m, i) => ({ ...m, g: n[m.key], pct: Math.round((k[i] / t) * 100), frac: k[i] / t }));
}

export function Donut({ n, size = 132, center }: { n: Nut; size?: number; center?: ReactNode }) {
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
