import { useId, useState, type ChangeEvent } from 'react';
import type { Ctx } from './App';
import { client, loadMoh, today } from './lib';
import { exportAll, restoreAll, supabase } from './db';
import { APP_VERSION } from './update';
import { Group, Why } from './ui';
import { Icon } from './icons';
import { ACTIVITY, AIMS, suggestGoals, type Body } from './goals';

const GOALS = [['kcal', 'קלוריות'], ['carbs', 'פחמימות (ג׳)'], ['fat', 'שומן (ג׳)'], ['protein', 'חלבון (ג׳)']] as const;
const BODY = [['age', 'גיל'], ['heightCm', 'גובה (ס״מ)'], ['weightKg', 'משקל (ק״ג)']] as const;
// Body measurements stay on this phone only; they just fill the goal fields.
const BODY_KEY = 'body';
const loadBody = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(BODY_KEY) || '{}'); } catch { return {}; }
};

export default function Settings({ ctx, email }: { ctx: Ctx; email: string }) {
  const p = ctx.profile;
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(GOALS.map(([k]) => [k, String(p?.[k] ?? '')])));
  const [msg, setMsg] = useState('');
  const [body, setBody] = useState<Record<string, string>>(() => ({ sex: 'f', activity: '1.375', aim: '-0.2', ...loadBody() }));
  const why = useId();
  const bodyReady = BODY.every(([k]) => Number(body[k]) > 0);
  const calc = () => {
    try { localStorage.setItem(BODY_KEY, JSON.stringify(body)); } catch { /* still fills the fields */ }
    const g = suggestGoals(Object.fromEntries(Object.entries(body).map(([k, x]) => [k, k === 'sex' ? x : Number(x)])) as Body);
    setV(Object.fromEntries(GOALS.map(([k]) => [k, String(g[k])])));
    setMsg('היעדים חושבו. אפשר לשנות ואז ״שמור יעדים״');
  };
  const macroKcal = Number(v.carbs) * 4 + Number(v.fat) * 9 + Number(v.protein) * 4;

  const save = async () => {
    const { data } = await client.models.Profile.update({ id: p!.id, ...Object.fromEntries(GOALS.map(([k]) => [k, Number(v[k]) || null])) });
    ctx.setProfile(data);
    setMsg('נשמר');
  };
  const download = async () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(await exportAll())], { type: 'application/json' }));
    a.download = `food-tracker-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg('הגיבוי ירד');
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
      <h1 className="page-title">הגדרות</h1>
      <Group title="יעדים יומיים" body="pad form">
        <details>
          <summary><Icon name="chevron-down" />חישוב לפי גובה ומשקל</summary>
          <div className="form">
            <div className="grid2">
              <label><span>מין</span><select value={body.sex} onChange={(e) => setBody({ ...body, sex: e.target.value })}><option value="f">אישה</option><option value="m">גבר</option></select></label>
              {BODY.map(([k, l]) => <label key={k}><span>{l}</span><input type="number" inputMode="decimal" value={body[k] ?? ''} onChange={(e) => setBody({ ...body, [k]: e.target.value })} /></label>)}
            </div>
            <label><span>פעילות</span><select value={body.activity} onChange={(e) => setBody({ ...body, activity: e.target.value })}>{ACTIVITY.map(([l, x]) => <option key={x} value={x}>{l}</option>)}</select></label>
            <label><span>מטרה</span><select value={body.aim} onChange={(e) => setBody({ ...body, aim: e.target.value })}>{AIMS.map(([l, x]) => <option key={x} value={x}>{l}</option>)}</select></label>
            <p className="muted small">הערכה בלבד: חלבון 1.8 ג׳ לק״ג, שומן 30% מהקלוריות והשאר פחמימות. כדאי לחשב שוב כשהמשקל משתנה.</p>
            <button className="btn" onClick={calc} disabled={!bodyReady} aria-describedby={bodyReady ? undefined : why}>חשב יעדים</button>
            {!bodyReady && <Why id={why}>מלאו גיל, גובה ומשקל כדי לחשב</Why>}
          </div>
        </details>
        <div className="grid2">
          {GOALS.map(([k, l]) => <label key={k}><span>{l}</span><input type="number" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>)}
        </div>
        <p className="muted small">המקרו־נוטריינטים שווים {Math.round(macroKcal)} קק״ל (פחמימות וחלבון 4 קק״ל/ג׳, שומן 9 קק״ל/ג׳).</p>
        <button className="btn primary" onClick={save}>שמור יעדים</button>
      </Group>
      <Group title="גיבוי" body="pad form">
        <p className="muted small">הנתונים נשמרים בחשבון שלך ומסונכרנים בין המכשירים. אפשר להוריד עותק כקובץ, ושחזור מקובץ מחליף את כל הנתונים בחשבון.</p>
        <button className="btn primary" onClick={download}>הורדת גיבוי</button>
        <label className="btn">
          <input type="file" accept="application/json,.json" className="sr-only" onChange={restore} />
          שחזור מגיבוי
        </label>
      </Group>
      <Group title="חשבון" body="pad form">
        <p className="muted small">מחובר בתור <b dir="ltr">{email}</b></p>
        <p className="muted small">גרסה <span dir="ltr">{APP_VERSION}</span></p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>יציאה</button>
      </Group>
      <div role="status">{msg && <button className="banner" onClick={() => setMsg('')}>{msg}</button>}</div>
    </div>
  );
}
