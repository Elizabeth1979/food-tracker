import { useId, useState } from 'react';
import type { Ctx } from './App';
import { client, saveWeight, today, type BodyInfo } from './lib';
import { Modal, Why } from './ui';
import { ACTIVITY, AIMS, CARB_PLANS, PROTEIN_PER_KG, proteinKg, restKcal, suggestGoals, type Goals } from './goals';

const BODY = [['age', 'גיל'], ['heightCm', 'גובה (ס״מ)']] as const;
const year = () => new Date().getFullYear();
// The form's fields as text. Before the profile had `body`, the calculator kept these on the phone only.
function bodyForm(b?: BodyInfo | null): Record<string, string> {
  if (b) return { sex: b.sex, age: String(year() - b.birthYear), heightCm: String(b.heightCm), activity: String(b.activity), aim: String(b.aim), carbsMax: String(b.carbsMax ?? 0) };
  const start = { sex: 'f', activity: '1.375', aim: '-0.2', carbsMax: '0' };
  try { return { ...start, ...JSON.parse(localStorage.getItem('body') || '{}') }; } catch { return start; }
}

const STEPS = ['הגוף שלך', 'פעילות ומטרה', 'פחמימות', 'סיכום'];

// Tailoring the goals, one or two questions a step; nothing changes until "השתמש ביעדים האלה".
export function Tailor({ ctx, onClose, onDone }: { ctx: Ctx; onClose: () => void; onDone: (msg: string) => void }) {
  const p = ctx.profile, last = ctx.weights.at(-1);
  const [step, setStep] = useState(0);
  const [body, setBody] = useState<Record<string, string>>(() => ({ ...bodyForm(p?.body), kg: last ? String(last.kg) : '' }));
  const why = useId();
  const set = (k: string) => (e: { target: { value: string } }) => setBody({ ...body, [k]: e.target.value });
  const age = Number(body.age), heightCm = Number(body.heightCm), weightKg = Number(body.kg);
  const missing = [!(weightKg > 0) && 'משקל', !(age > 0) && 'גיל', !(heightCm > 0) && 'גובה'].filter(Boolean).join(', ');
  const info: BodyInfo = { sex: body.sex as BodyInfo['sex'], birthYear: year() - age, heightCm, activity: Number(body.activity), aim: Number(body.aim), carbsMax: Number(body.carbsMax) };
  const plan = missing ? null : suggestGoals({ ...info, age, weightKg, carbsMax: info.carbsMax! });

  const use = async () => {
    // A changed weight is today's weigh-in (keeping a waist already logged today); goals then follow the plan.
    if (weightKg !== last?.kg) ctx.setWeights(await saveWeight(ctx.weights, weightKg, ctx.weights.find((w) => w.date === today())?.waist ?? null));
    const { data } = await client.models.Profile.update({ id: p!.id, body: info, ...plan! });
    ctx.setProfile(data);
    onDone(`היעדים עודכנו: ${plan!.kcal} קק״ל, חלבון ${plan!.protein} ג׳`);
  };

  return (
    <Modal title="התאמה אישית" onClose={onClose} onBack={() => { if (!step) return false; setStep(step - 1); return true; }}>
      <div className="form">
        <p className="muted small">שלב {step + 1} מתוך {STEPS.length}: {STEPS[step]}</p>
        {step === 0 && (
          <div className="grid2">
            <label><span>מין</span><select value={body.sex} onChange={set('sex')}><option value="f">אישה</option><option value="m">גבר</option></select></label>
            {BODY.map(([k, l]) => <label key={k}><span>{l}</span><input type="number" inputMode="decimal" value={body[k] ?? ''} onChange={set(k)} /></label>)}
            <label><span>משקל (ק״ג)</span><input type="number" inputMode="decimal" step="0.1" value={body.kg} onChange={set('kg')} /></label>
          </div>
        )}
        {step === 1 && <>
          <label><span>פעילות</span><select value={body.activity} onChange={set('activity')}>{ACTIVITY.map(([l, x]) => <option key={x} value={x}>{l}</option>)}</select></label>
          <label><span>מטרה</span><select value={body.aim} onChange={set('aim')}>{AIMS.map(([l, x]) => <option key={x} value={x}>{l}</option>)}</select></label>
        </>}
        {step === 2 && (
          <fieldset className="form">
            <legend className="muted small">כמה פחמימות ביום?</legend>
            {CARB_PLANS.map(([l, x]) => <label key={x}><input type="radio" name="carbs" value={x} checked={body.carbsMax === String(x)} onChange={set('carbsMax')} />{l}</label>)}
          </fieldset>
        )}
        {step === 3 && plan && <>
          <Plan goals={plan} info={info} age={age} weightKg={weightKg} />
          <p className="muted small">זו הערכה, לא ייעוץ רפואי. אחר כך אפשר לשנות כל יעד ב״עריכה ידנית״.</p>
        </>}
        <div className="grid2">
          {step > 0 ? <button className="btn" onClick={() => setStep(step - 1)}>חזרה</button> : <span />}
          {step < STEPS.length - 1
            ? <button className="btn primary" onClick={() => setStep(step + 1)} disabled={!!missing} aria-describedby={missing ? why : undefined}>הבא</button>
            : <button className="btn primary" onClick={use}>השתמש ביעדים האלה</button>}
        </div>
        {missing && <Why id={why}>חסר: {missing}</Why>}
      </div>
    </Modal>
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
