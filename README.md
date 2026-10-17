# יומן תזונה — Food Tracker

A personal calorie and macro diary in Hebrew (right-to-left) for mobile and desktop.

Data lives in **Supabase**, so it syncs across devices. You sign in with a magic link sent by email, and Row Level Security means each account sees only its own rows. New sign-ups are turned off, so it stays a single-user app.

## Features
- A daily diary split into breakfast, lunch, dinner and snacks. It opens on today in local time, and a calendar jumps to any other day.
- Foods come from the Ministry of Health Tzameret database (`public/foods/moh.json`, 4,624 foods with piece and cup weights) plus foods you add yourself. Amounts can be entered in grams or in pieces.
- Saved meals (one tap adds all of their items), and "copy from yesterday" for each meal.
- Whole meals in one go: type a line like `יוגורט 150 גרם, 10 ענבים, כף חמאת בוטנים`, or take a photo, then check the list and add everything at once (add dialog → ✍️ כתיבה ותמונה). Calories always come from the food database; the photo only names foods and guesses amounts.
- Search prefers plain foods ("ענבים" finds fresh grapes before grape juice), shows FFQ questionnaire averages last with a tag, and puts recently logged foods first on every device.
- Tap any food in the מזונות tab to log it. New units ("פרוסה" = 20 g) can be added right in the amount picker, and the new-food form has a zero-calorie shortcut for supplements.
- Daily goals (default 2000 kcal, 250 g carbs, 65 g fat, 100 g protein), a calorie and macro donut, and weekly or monthly reports. Any date range exports to CSV, or to PDF through the print dialog ("Save as PDF").
- Download and restore as a JSON file (Settings → גיבוי). The format matches the earlier local-only version, so old backups restore here.

## Run it
Requires Node 20 or later.

```sh
npm install
cp .env.example .env   # then fill in the project URL and publishable key
npm run dev            # http://localhost:5173
npm run build          # type-check + production build into dist/
npm run preview        # serve the production build locally
```

## Database setup (Supabase)
1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor. It creates the four tables, turns on RLS, and adds one `own` policy per table: a row is readable and writable only by the user it belongs to.
2. Put the project URL and **publishable** key (`sb_publishable_…`) in `.env`. Both are public by design. Never use the secret / `service_role` key in this app.
3. In **Authentication → URL Configuration**, set **Site URL** to the production URL, and add the production URL and `http://localhost:5173` under **Redirect URLs**. The magic link only redirects to allowed URLs.
4. Sign in once to create your account. Then turn off **Authentication → Sign In / Providers → Allow new users to sign up**.

## Photo logging (optional)
The photo button calls the `meal-photo` Edge Function ([`supabase/functions/meal-photo`](supabase/functions/meal-photo/index.ts)), which asks Claude (Haiku by default) to name the foods. It needs an Anthropic API key, kept as a Supabase secret and never shipped to the browser. Without one, the button shows a "not set up" message and typing still works.

1. Create a key at [console.anthropic.com](https://console.anthropic.com) and add a few dollars of credit. A photo costs a fraction of a cent. Setting a monthly spend limit there is a good idea.
2. Store it as a secret: Supabase dashboard → **Edge Functions → Secrets** → `ANTHROPIC_API_KEY`, or `supabase secrets set ANTHROPIC_API_KEY=...`.
3. Deploy after changes: `supabase functions deploy meal-photo`. Only signed-in users can call it. Set `MEAL_PHOTO_MODEL` to try another model.

## How the data works
| Path | What |
|---|---|
| `src/db.ts` | Supabase client and data layer. Exposes `client.models.X.list/create/update/delete` for `Food`, `Entry`, `SavedMeal`, `Profile` (tables `foods`, `entries`, `saved_meals`, `profiles`), plus backup export and restore. |
| `src/lib.ts` | Loading, nutrition math and the photo call. MoH foods are fetched from `/foods/moh.json` at runtime and never copied into the database. A `foods` row with the same id overrides a MoH food; that is how edits, added units and "hidden" work. |
| `src/search.ts` | Search ranking and the free-text meal parser. No data-layer imports, so it runs under plain Node for quick checks. |
| `src/Login.tsx`, `src/main.tsx` | Magic-link sign-in, and the gate that shows the app only with a session. |
| `src/` components | `Day`, `AddDialog`, `Review` (the list a typed meal or photo becomes), `Reports`, `Foods`, `MealEditor`, `Settings` |
| `public/sw.js` | A network-first service worker for the app shell. The data itself needs a connection. |

## Deploy
It's a static Vite site. On Vercel, use framework **Vite**, build command `npm run build`, and output directory `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as environment variables.
