import { useState, type ChangeEvent } from 'react';
import type { Ctx } from './App';
import { client, exportPhotos, loadMoh, restorePhotos, today, type Profile } from './lib';
import { exportAll, restoreAll, supabase } from './db';
import { APP_VERSION } from './update';
import { Group, confirmIt } from './ui';
import { goalsOf } from './goals';
import { Tailor } from './Tailor';

const GOALS = [['kcal', 'קלוריות'], ['carbs', 'פחמימות (ג׳)'], ['fat', 'שומן (ג׳)'], ['protein', 'חלבון (ג׳)']] as const;
export default function Settings({ ctx, email }: { ctx: Ctx; email: string }) {
  const p = ctx.profile;
  const goalForm = (g: Partial<Profile> | null) => Object.fromEntries(GOALS.map(([k]) => [k, String(goalsOf(g)[k])]));
  const [v, setV] = useState<Record<string, string>>(() => goalForm(p));
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const g = goalsOf(p);
  const macroKcal = Number(v.carbs) * 4 + Number(v.fat) * 9 + Number(v.protein) * 4;

  const saveGoals = async (patch: Partial<Profile>) => {
    const { data } = await client.models.Profile.update({ id: p!.id, ...patch });
    ctx.setProfile(data);
    setV(goalForm(data));
  };
  const save = async () => {
    await saveGoals(Object.fromEntries(GOALS.map(([k]) => [k, Number(v[k]) || null])));
    setEditing(false);
    setMsg('נשמר');
  };
  // The meal photos ride along under "Photo"; a backup without it (older ones) restores the data and leaves photos be.
  const download = async () => {
    setMsg('מכין את הגיבוי…');
    const [data, Photo] = await Promise.all([exportAll(), exportPhotos()]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...data, Photo })], { type: 'application/json' }));
    a.download = `food-tracker-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg('הגיבוי ירד');
  };
  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file || !(await confirmIt('השחזור יחליף את כל הנתונים באפליקציה בתוכן הגיבוי. להמשיך?', 'שחזור'))) return;
    try {
      const { Photo, ...data } = JSON.parse(await file.text());
      await restoreAll(data, await loadMoh());
      if (Array.isArray(Photo)) await restorePhotos(Photo);
      location.reload();
    } catch (err: any) { setMsg('השחזור נכשל: ' + err.message); }
  };

  return (
    <div className="stack">
      <h1 className="page-title">הגדרות</h1>
      <Group title="היעדים שלך" body="pad form">
        <p><b>{g.kcal} קק״ל</b> · חלבון {g.protein} ג׳ · פחמימות {g.carbs} ג׳ · שומן {g.fat} ג׳</p>
        <p className="muted small">{p?.body ? 'מותאמים לגוף ולמטרה שלך.' : 'כלליים (הערכים מתוויות המזון), לא מותאמים לגוף שלך.'}</p>
        {editing ? <>
          <div className="grid2">
            {GOALS.map(([k, l]) => <label key={k}><span>{l}</span><input type="number" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>)}
          </div>
          {/* The macros' calories should come close to the calorie goal; say so when they don't */}
          {Math.abs(macroKcal - Number(v.kcal)) > Number(v.kcal) * 0.1
            ? <p className="warn-text small">הפחמימות, השומן והחלבון שווים יחד {Math.round(macroKcal)} קק״ל, לא {v.kcal}. כדאי שיתאימו.</p>
            : <p className="muted small">הפחמימות, השומן והחלבון שווים יחד {Math.round(macroKcal)} קק״ל (פחמימות וחלבון 4 קק״ל לגרם, שומן 9).</p>}
          <div className="grid2">
            <button className="btn" onClick={() => setEditing(false)}>ביטול</button>
            <button className="btn primary" onClick={save}>שמור יעדים</button>
          </div>
        </> : <>
          <button className="btn primary" onClick={() => setTailoring(true)}>{p?.body ? 'עדכון ההתאמה האישית' : 'התאמה אישית'}</button>
          <button className="link" onClick={() => { setV(goalForm(p)); setEditing(true); }}>עריכה ידנית</button>
        </>}
      </Group>
      {tailoring && <Tailor ctx={ctx} onClose={() => setTailoring(false)} onDone={(m) => { setTailoring(false); setMsg(m); }} />}
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
