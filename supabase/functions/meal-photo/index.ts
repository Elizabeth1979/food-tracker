// Names the foods in a meal photo, with rough amounts, for the app's review list.
// The app matches each name to its food database itself, so calories never come from the model.
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

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return reply({ error: 'זיהוי תמונות עוד לא הוגדר (חסר מפתח API בשרת).' });
  let image: string, note: string;
  try {
    ({ image, note = '' } = await req.json());
  } catch {
    return reply({ error: 'בקשה לא תקינה' }, 400);
  }
  if (typeof image !== 'string' || !image || image.length > 3_000_000) return reply({ error: 'התמונה חסרה או גדולה מדי' }, 400);

  try {
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
    return reply({ error: status === 401 ? 'מפתח ה־API בשרת לא תקין.' : status === 429 ? 'יותר מדי בקשות, נסו שוב בעוד רגע.' : 'זיהוי התמונה נכשל. נסו שוב או כתבו את הארוחה.' });
  }
});
