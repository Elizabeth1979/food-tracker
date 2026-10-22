import { useId, useState, type ChangeEvent } from 'react';
import type { Ctx } from './App';
import { client, fmtDate, loadMoh, today, type BodyInfo, type Profile, type Weight } from './lib';
import { exportAll, restoreAll, supabase } from './db';
import { APP_VERSION } from './update';
import { Group, Why } from './ui';
import { Icon } from './icons';
import { ACTIVITY, AIMS, CARB_PLANS, PROTEIN_PER_KG, goalsOf, proteinKg, restKcal, suggestGoals, type Goals } from './goals';

const GOALS = [['kcal', 'קלוריות'], ['carbs', 'פחמימות (ג׳)'], ['fat', 'שומן (ג׳)'], ['protein', 'חלבון (ג׳)']] as const;
const BODY = [['age', 'גיל'], ['heightCm', 'גובה (ס״מ)']] as const;
const year = () => new Date().getFullYear();
// The form's fields as text. Before the profile had `body`, the calculator kept these on the phone only.
function bodyForm(b?: BodyInfo | null): Record<string, string> {
  if (b) return { sex: b.sex, age: String(year() - b.birthYear), heightCm: String(b.heightCm), activity: String(b.activity), aim: String(b.aim), carbsMax: String(b.carbsMax ?? 0) };
  const start = { sex: 'f', activity: '1.375', aim: '-0.2', carbsMax: '0' };
  try { return { ...start, ...JSON.parse(localStorage.getItem('body') || '{}') }; } catch { return start; }
}

export default function Settings({ ctx, email }: { ctx: Ctx; email: string }) {
  const p = ctx.profile;
  const goalForm = (g: Partial<Profile> | null) => Object.fromEntries(GOALS.map(([k]) => [k, String(goalsOf(g)[k])]));
  const [v, setV] = useState<Record<string, string>>(() => goalForm(p));
  const [msg, setMsg] = useState('');
  const last = ctx.weights.at(-1);
  const [kg, setKg] = useState(() => (last?.date === today() ? String(last.kg) : ''));
  const [waist, setWaist] = useState(() => (last?.date === today() ? String(last.waist ?? '') : ''));
  const [body, setBody] = useState(() => bodyForm(p?.body));
  const why = useId();
  // Tailoring uses the latest weigh-in; what's missing is named rather than guessed.
  const weightKg = last?.kg ?? 0, age = Number(body.age), heightCm = Number(body.heightCm);
  const missing = [!weightKg && 'משקל (שמרו שקילה למעלה)', !(age > 0) && 'גיל', !(heightCm > 0) && 'גובה'].filter(Boolean).join(', ');
  const info: BodyInfo = { sex: body.sex as BodyInfo['sex'], birthYear: year() - age, heightCm, activity: Number(body.activity), aim: Number(body.aim), carbsMax: Number(body.carbsMax) };
  const plan = missing ? null : suggestGoals({ ...info, age, weightKg, carbsMax: info.carbsMax! });
  const macroKcal = Number(v.carbs) * 4 + Number(v.fat) * 9 + Number(v.protein) * 4;

  const saveGoals = async (patch: Partial<Profile>) => {
    const { data } = await client.models.Profile.update({ id: p!.id, ...patch });
    ctx.setProfile(data);
    setV(goalForm(data));
  };
  const save = async () => {
    await saveGoals(Object.fromEntries(GOALS.map(([k]) => [k, Number(v[k]) || null])));
    setMsg('נשמר');
  };
  // One weigh-in a day (a second one replaces it). It only logs; goals change only from "use these goals".
  const weighIn = async () => {
    const row = { id: ctx.weights.find((w) => w.date === today())?.id, date: today(), kg: Number(kg), waist: Number(waist) || null };
    const { data } = row.id ? await client.models.Weight.update(row as Weight) : await client.models.Weight.create(row);
    ctx.setWeights([...ctx.weights.filter((w) => w.id !== data.id), data].sort((a, b) => a.date.localeCompare(b.date)));
    setMsg(p?.body ? 'השקילה נשמרה. לעדכון היעדים לפי המשקל החדש: התאמת היעדים' : 'השקילה נשמרה');
  };
  const tailor = async () => {
    await saveGoals({ body: info, ...plan! });
    setMsg(`היעדים עודכנו: ${plan!.kcal} קק״ל, חלבון ${plan!.protein} ג׳`);
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
        <div className="grid2">
          {GOALS.map(([k, l]) => <label key={k}><span>{l}</span><input type="number" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>)}
        </div>
        <p className="muted small">המקרו־נוטריינטים שווים {Math.round(macroKcal)} קק״ל (פחמימות וחלבון 4 קק״ל/ג׳, שומן 9 קק״ל/ג׳).</p>
        <button className="btn primary" onClick={save}>שמור יעדים</button>
      </Group>
      <Group title="שקילה" body="pad form">
        <div className="grid2">
          <label><span>משקל היום (ק״ג)</span><input type="number" inputMode="decimal" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} /></label>
          <label><span>מותניים (ס״מ, לא חובה)</span><input type="number" inputMode="decimal" step="0.5" value={waist} onChange={(e) => setWaist(e.target.value)} /></label>
        </div>
        {last && <p className="muted small">שקילה אחרונה: {last.kg} ק״ג{last.waist ? `, מותניים ${last.waist} ס״מ` : ''}, {fmtDate(last.date, { day: 'numeric', month: 'long' })}</p>}
        <p className="muted small">פעם בשבוע, בבוקר; מותניים בגובה הטבור. השקילה נשמרת לגרף ולא משנה את היעדים.</p>
        <button className="btn primary" onClick={weighIn} disabled={!(Number(kg) > 0)}>שמור שקילה</button>
      </Group>
      <Group title="התאמת היעדים" body="pad form">
        <details open={!p?.body}>
          <summary><Icon name="chevron-down" />חישוב לפי הגוף והמטרה שלך</summary>
          <div className="form">
            <div className="grid2">
              <label><span>מין</span><select value={body.sex} onChange={(e) => setBody({ ...body, sex: e.target.value })}><option value="f">אישה</option><option value="m">גבר</option></select></label>
              {BODY.map(([k, l]) => <label key={k}><span>{l}</span><input type="number" inputMode="decimal" value={body[k] ?? ''} onChange={(e) => setBody({ ...body, [k]: e.target.value })} /></label>)}
            </div>
            <label><span>פעילות</span><select value={body.activity} onChange={(e) => setBody({ ...body, activity: e.target.value })}>{ACTIVITY.map(([l, x]) => <option key={x} value={x}>{l}</option>)}</select></label>
            <label><span>מטרה</span><select value={body.aim} onChange={(e) => setBody({ ...body, aim: e.target.value })}>{AIMS.map(([l, x]) => <option key={x} value={x}>{l}</option>)}</select></label>
            <label><span>פחמימות</span><select value={body.carbsMax} onChange={(e) => setBody({ ...body, carbsMax: e.target.value })}>{CARB_PLANS.map(([l, x]) => <option key={x} value={x}>{l}</option>)}</select></label>
            {plan ? <Plan goals={plan} info={info} age={age} weightKg={weightKg} /> : <p className="muted small">חסר לחישוב: {missing}.</p>}
            <p className="muted small">זו הערכה, לא ייעוץ רפואי. אחרי השימוש אפשר לשנות כל יעד ידנית למעלה.</p>
            <button className="btn primary" onClick={tailor} disabled={!plan} aria-describedby={plan ? undefined : why}>השתמש ביעדים האלה</button>
            {!plan && <Why id={why}>חסר: {missing}</Why>}
          </div>
        </details>
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

// The suggested goals, each with the arithmetic behind it in the user's own numbers.
function Plan({ goals: g, info, age, weightKg }: { goals: Goals; info: BodyInfo; age: number; weightKg: number }) {
  const counted = proteinKg(weightKg, info.heightCm);
  const rest = restKcal({ sex: info.sex, age, heightCm: info.heightCm, weightKg });
  const burn = Math.round(rest * info.activity);
  const fatPct = Math.round((g.fat * 9 * 100) / g.kcal);
  return (
    <dl className="plan">
      <dt>קלוריות: {g.kcal}</dt>
      <dd>בגוף במנוחה {rest} (נוסחת מיפלין־סנט ג׳ואור, לפי מין, גיל, גובה ומשקל), × {info.activity} לפעילות = {burn}
        {info.aim < 0 ? `, פחות ${-info.aim * 100}% כדי לרדת במשקל` : info.aim > 0 ? `, ועוד ${info.aim * 100}% לבניית מסה` : ''}
        {g.kcal <= rest + 10 && info.aim < 0 ? '. לא פחות מקצב המנוחה, כדי לא לאבד שריר' : ''}.</dd>
      <dt>חלבון: לפחות {g.protein} ג׳</dt>
      <dd>{PROTEIN_PER_KG} ג׳ × {counted} ק״ג{counted < weightKg ? ` (לא ${weightKg}: נספר עד המשקל שבו BMI הוא 25 בגובה שלך)` : ''}, לשמירה על שריר ולבנייתו.</dd>
      <dt>פחמימות: עד {g.carbs} ג׳</dt>
      <dd>{info.carbsMax ? `לפי התוכנית שבחרת${g.carbs < info.carbsMax ? `, פחות מ־${info.carbsMax} כי זה מה שנשאר בקלוריות` : ''}.` : 'מה שנשאר אחרי חלבון ו־30% שומן.'}</dd>
      <dt>שומן: {g.fat} ג׳</dt>
      <dd>{fatPct}% מהקלוריות, מה שנשאר.{fatPct < 20 && <strong className="warn-text"> פחות מ־20%: כדאי מטרה אחרת או יותר פעילות.</strong>}</dd>
    </dl>
  );
}
