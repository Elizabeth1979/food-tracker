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
- Packaged products the database lacks: in the new-food form, "📷 צלם טבלת ערכים" reads the package's nutrition table (טבלת ערכים תזונתיים) and fills in the values per 100 g, plus the serving as a unit ("יחידה" = 30 g) when the label gives one. Labels that list only per-serving values are converted. Check the numbers against the package, then save. This is the one place calories come from a photo, and only into a food you check and save yourself.
- Daily goals (default 2000 kcal, 250 g carbs, 65 g fat, 100 g protein), a calorie and macro donut, and weekly or monthly reports. Any date range exports to CSV, or to PDF through the print dialog ("Save as PDF").
- Works without a connection: the app opens on the phone with your foods, saved meals and the last three months of the diary, and anything you log, edit or delete offline is sent in order once the connection is back. You stay signed in offline.
- Download and restore as a JSON file (Settings → גיבוי). The format matches the earlier local-only version, so old backups restore here.

## Run it
Requires Node 20 or later.

```sh
npm install
cp .env.example .env   # then fill in the project URL and publishable key
npm run dev            # http://localhost:5173
npm run dev:test       # http://localhost:5174, test mode: no sign-in, data only in this browser, sample photo and label answers
npm run build          # type-check + production build into dist/
npm test               # search and meal-parser tests (Vercel runs them before every deploy)
npm run preview        # serve the production build locally
```

## Database setup (Supabase)
1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor. It creates the four tables, turns on RLS, and adds one `own` policy per table: a row is readable and writable only by the user it belongs to.
2. Put the project URL and **publishable** key (`sb_publishable_…`) in `.env`. Both are public by design. Never use the secret / `service_role` key in this app.
3. In **Authentication → URL Configuration**, set **Site URL** to the production URL, and add the production URL and `http://localhost:5173` under **Redirect URLs**. The magic link only redirects to allowed URLs.
4. Sign in once to create your account. Then turn off **Authentication → Sign In / Providers → Allow new users to sign up**.

## Photo logging (optional)
The photo buttons call the `meal-photo` Edge Function ([`supabase/functions/meal-photo`](supabase/functions/meal-photo/index.ts)), which asks Claude (Haiku by default) to name the foods in a meal photo, or, with `mode: 'label'`, to read a nutrition table for the new-food form. It needs an Anthropic API key, kept as a Supabase secret and never shipped to the browser. Without one, the button shows a "not set up" message and typing still works.

1. Create a key at [console.anthropic.com](https://console.anthropic.com) and add a few dollars of credit. A photo costs a fraction of a cent. Setting a monthly spend limit there is a good idea.
2. Store it as a secret: Supabase dashboard → **Edge Functions → Secrets** → `ANTHROPIC_API_KEY`, or `supabase secrets set ANTHROPIC_API_KEY=...`.
3. Deploy after changes: `supabase functions deploy meal-photo`. Only signed-in users can call it. Set `MEAL_PHOTO_MODEL` to try another model.

## How the data works
| Path | What |
|---|---|
| `src/db.ts` | Supabase client and data layer. Exposes `client.models.X.list/create/update/delete` for `Food`, `Entry`, `SavedMeal`, `Profile` (tables `foods`, `entries`, `saved_meals`, `profiles`), plus backup export and restore. It also keeps a copy of each list on the device and queues changes made offline (`syncPending` sends them). |
| `src/lib.ts` | Loading, nutrition math and the photo call. MoH foods are fetched from `/foods/moh.json` at runtime and never copied into the database. A `foods` row with the same id overrides a MoH food; that is how edits, added units and "hidden" work. |
| `src/search.ts` | Search ranking and the free-text meal parser. No data-layer imports, so it runs under plain Node for quick checks. |
| `src/Login.tsx`, `src/main.tsx` | Magic-link sign-in, and the gate that shows the app only with a session. |
| `src/` components | `Day`, `AddDialog`, `Review` (the list a typed meal or photo becomes), `Reports`, `Foods`, `MealEditor`, `Settings` |
| `public/sw.js` | A network-first service worker for the app shell and `moh.json`. The data's offline copy lives in `src/db.ts`. |
| `vercel.json` | Security headers. The Content-Security-Policy allows only the app itself, the Supabase project and Google Fonts. |

## Where it runs
| What | Where |
|---|---|
| The app (production) | **https://food-tracker-nine-khaki.vercel.app**, Vercel project `food-tracker` in the team *Elizabeth's projects*. |
| Deploys | Automatic: Vercel watches `main` on [GitHub](https://github.com/Elizabeth1979/food-tracker) and deploys every push. There is no `.vercel/` folder here because nothing deploys from this computer. |
| Database and sign-in | Supabase project `food-tracker` (ref `ujlbjojzjrwkzhymmhfs`, region eu-central-1). Schema: [`supabase/schema.sql`](supabase/schema.sql). The `profiles.recent` column was added as migration `profiles_recent_foods`. |
| Photo recognition | Supabase Edge Function `meal-photo` in the same project: meal photos, and nutrition labels (`mode: 'label'`). It needs the secret `ANTHROPIC_API_KEY` (Edge Functions → Secrets). |
| Environment variables | `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`: in `.env` locally (not in git), and in the Vercel project settings for production. |

## Deploy
It's a static Vite site. On Vercel, use framework **Vite**, build command `npm run build`, and output directory `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as environment variables.

The Vercel project is connected to the GitHub repo, so every push to `main` deploys to production by itself. Each build writes its id (the commit on Vercel) into the app and into `/version.json`. An open or home-screen copy of the app checks that file whenever it comes back to the front, and every half hour while it stays open. When a newer build is live, it reloads right away, or shows a "גרסה חדשה" bar if a dialog is open so nothing half-entered is lost. Settings → חשבון shows the running version.
