import { useState, type ChangeEvent } from 'react';
import type { Ctx } from './App';
import { client, loadMoh, today } from './lib';
import { exportAll, restoreAll, supabase } from './db';
import { APP_VERSION } from './update';

const GOALS = [['kcal', 'קלוריות'], ['carbs', 'פחמימות (ג׳)'], ['fat', 'שומן (ג׳)'], ['protein', 'חלבון (ג׳)']] as const;

export default function Settings({ ctx, email }: { ctx: Ctx; email: string }) {
  const p = ctx.profile;
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(GOALS.map(([k]) => [k, String(p?.[k] ?? '')])));
  const [msg, setMsg] = useState('');
  const macroKcal = Number(v.carbs) * 4 + Number(v.fat) * 9 + Number(v.protein) * 4;

  const save = async () => {
    const { data } = await client.models.Profile.update({ id: p!.id, ...Object.fromEntries(GOALS.map(([k]) => [k, Number(v[k]) || null])) });
    ctx.setProfile(data);
    setMsg('נשמר ✓');
  };
  const download = async () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(await exportAll())], { type: 'application/json' }));
    a.download = `food-tracker-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg('הגיבוי ירד ✓');
  };
  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file || !confirm('השחזור יחליף את כל הנתונים באפליקציה בתוכן הגיבוי. להמשיך?')) return;
    try {
      await restoreAll(JSON.parse(await file.text()), await loadMoh());
      location.reload();
    } catch (err: any) { setMsg('השחזור נכשל: ' + err.message); }
  };

  return (
    <div className="stack">
      <section className="card pad form">
        <h3>יעדים יומיים</h3>
        <div className="grid2">
          {GOALS.map(([k, l]) => <label key={k}><span>{l}</span><input type="number" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>)}
        </div>
        <p className="muted small">המקרו־נוטריינטים שווים {Math.round(macroKcal)} קק״ל (פחמימות וחלבון 4 קק״ל/ג׳, שומן 9 קק״ל/ג׳).</p>
        <button className="btn primary" onClick={save}>שמור יעדים</button>
      </section>
      <section className="card pad form">
        <h3>גיבוי</h3>
        <p className="muted small">הנתונים נשמרים בחשבון שלך ומסונכרנים בין המכשירים. אפשר להוריד עותק כקובץ, ושחזור מקובץ מחליף את כל הנתונים בחשבון.</p>
        <button className="btn primary" onClick={download}>הורדת גיבוי</button>
        <label className="btn">
          <input type="file" accept="application/json,.json" className="sr-only" onChange={restore} />
          שחזור מגיבוי
        </label>
      </section>
      <section className="card pad form">
        <h3>חשבון</h3>
        <p className="muted small">מחובר בתור <b dir="ltr">{email}</b></p>
        <p className="muted small">גרסה <span dir="ltr">{APP_VERSION}</span></p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>יציאה</button>
      </section>
      <div role="status">{msg && <button className="banner" onClick={() => setMsg('')}>{msg}</button>}</div>
    </div>
  );
}
