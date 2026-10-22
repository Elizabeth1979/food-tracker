// Names the foods in a meal photo, with rough amounts, for the app's review list.
// The app matches each name to its food database itself, so calories never come from the model.
// With `mode: 'label'` it instead reads a printed nutrition table (טבלת ערכים תזונתיים) into per-100 g values
// for the new-food form, which the user checks before saving.
// Needs the ANTHROPIC_API_KEY secret; only signed-in users can call it (verify_jwt).
import Anthropic from 'npm:@anthropic-ai/sdk@0.129.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@0.129.0/helpers/zod';
import { z } from 'npm:zod@4.6.5';

const MODEL = Deno.env.get('MEAL_PHOTO_MODEL') ?? 'claude-haiku-5-5';
// The unit words the app's parser and food database understand.
const UNITS = ['גרם', 'כף', 'כפית', 'כוס', 'ספל', 'יחידה', 'פרוסה', 'גביע', 'מנה', 'חופן'] as const;

const Meal = z.object({
  items: z.array(z.object({
    name: z.string().describe('Short generic Hebrew food name, e.g. "ענבים", "יוגורט 3%", "חמאת בוטנים"'),
    qty: z.number().describe('How many of `unit`'),
    unit: z.enum(UNITS),
  })),
});

const SYSTEM = `You look at a photo of a meal and list the foods in it for a Hebrew food diary.
- One item per food, Hebrew names as they appear in the Israeli Ministry of Health food database (צמרת): generic and short ("ענבים", "גבינה לבנה 5%", "לחם מלא"), no brands unless the packaging shows one.
- Estimate each amount in the most natural unit: pieces (יחידה) for countable foods, spoons (כף/כפית) for spreads and toppings, cups or a גביע for yogurt, grams when nothing else fits.
- The user's note is more reliable than the photo: when it names a food or an amount, use it, and add foods it mentions that the photo hides.
- If the photo shows no food, return an empty list.`;

// The label is transcribed as printed; turning per-serving values into per-100 g is done below, not by the model.
const num = (d: string) => z.number().describe(d);
const opt = (d: string) => z.number().nullable().describe(`${d}, or null when the label doesn't list it`);
const Label = z.object({
  isLabel: z.boolean().describe('false when the photo is not a nutrition facts table'),
  name: z.string().describe('Product name in Hebrew as printed on the package, or "" when not visible'),
  per: z.enum(['100g', 'serving']).describe('Which column the values below come from: "100g" (also per 100 ml) whenever the label has it'),
  servingG: z.number().nullable().describe('Grams (or ml) in one serving, when the label states it'),
  servingIsPiece: z.boolean().describe('true when the label says one serving is a single countable piece, e.g. "מנה = 1 מסטיק", "1 חטיף", "1 יחידה"; false for a bag, a cup, grams only, or several pieces'),
  kcal: num('Energy in kcal (קלוריות), not kJ'),
  carbs: num('Total carbohydrates (פחמימות) in g, not just the sugars line'),
  fat: num('Total fat (שומנים) in g'),
  protein: num('Protein (חלבונים) in g'),
  sodium: opt('Sodium (נתרן) in mg; if only salt in g is printed, salt × 400'),
  calcium: opt('Calcium (סידן) in mg'),
  potassium: opt('Potassium (אשלגן) in mg'),
  b12: opt('Vitamin B12 in micrograms (מק״ג)'),
});

const LABEL_SYSTEM = `You read the nutrition facts table (טבלת ערכים תזונתיים) on an Israeli food package, for a Hebrew food diary.
- Copy the numbers exactly as printed. Prefer the "ל-100 גרם" / "ל-100 מ״ל" column; use the per-serving column ("למנה") only when there is no per-100 column.
- A value printed as "פחות מ-0.5" or "<0.5" counts as 0.
- If the photo isn't a nutrition table, or it is too blurry to read the energy and macros, set isLabel to false.`;

async function readLabel(image: string) {
  const res = await new Anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: zodOutputFormat(Label) },
    system: LABEL_SYSTEM,
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } }] }],
  });
  const l = res.parsed_output;
  if (res.stop_reason === 'refusal' || !l || !l.isLabel) return reply({ error: 'לא מצאתי בתמונה טבלת ערכים תזונתיים. נסו לצלם אותה מקרוב, ישר ובאור טוב.' });
  const servingG = l.servingG && l.servingG > 0 ? l.servingG : null;
  if (l.per === 'serving' && !servingG) return reply({ error: 'בטבלה יש ערכים למנה בלבד, בלי משקל המנה. אפשר למלא את הערכים ידנית ולכתוב את משקל המנה.' });
  const f = l.per === 'serving' ? 100 / servingG! : 1;
  const at = (x: number | null, dp = 1) => (x == null ? null : Math.round(x * f * 10 ** dp) / 10 ** dp);
  return reply({
    label: {
      name: l.name.trim(),
      kcal: at(l.kcal, 0), carbs: at(l.carbs), fat: at(l.fat), protein: at(l.protein),
      sodium: at(l.sodium, 0), calcium: at(l.calcium, 0), potassium: at(l.potassium, 0), b12: at(l.b12, 2),
      // "יחידה" only when the label's serving is one piece (a gum, a bar); otherwise "מנה", since a serving is often
      // the whole bag and calling that "יחידה" would take the name a single piece needs.
      unit: servingG ? { n: l.servingIsPiece ? 'יחידה' : 'מנה', g: servingG } : null,
      perServing: l.per === 'serving',
    },
  });
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return reply({ error: 'זיהוי תמונות עוד לא הוגדר (חסר מפתח API בשרת).' });
  let image: string, note: string, mode: string;
  try {
    ({ image, note = '', mode = 'meal' } = await req.json());
  } catch {
    return reply({ error: 'בקשה לא תקינה' }, 400);
  }
  if (typeof image !== 'string' || !image || image.length > 3_000_000) return reply({ error: 'התמונה חסרה או גדולה מדי' }, 400);

  try {
    if (mode === 'label') return await readLabel(image);
    const res = await new Anthropic().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: zodOutputFormat(Meal) },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: note.trim() ? `הערה: ${note.trim().slice(0, 500)}` : 'אין הערה.' },
        ],
      }],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) return reply({ error: 'לא הצלחתי לזהות מזונות בתמונה. אפשר לכתוב את הארוחה במקום.' });
    return reply({ items: res.parsed_output.items.filter((i) => i.name.trim() && i.qty > 0) });
  } catch (e) {
    console.error(e);
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    return reply({ error: status === 401 ? 'מפתח ה־API בשרת לא תקין.' : status === 429 ? 'יותר מדי בקשות, נסו שוב בעוד רגע.' : mode === 'label' ? 'קריאת הטבלה נכשלה. נסו שוב או מלאו את הערכים ידנית.' : 'זיהוי התמונה נכשל. נסו שוב או כתבו את הארוחה.' });
  }
});
