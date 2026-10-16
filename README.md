# יומן תזונה — Food Tracker

A personal calorie and macro diary in Hebrew (right-to-left) for mobile and desktop.

Data lives in **Supabase**, so it syncs across devices. You sign in with a magic link sent by email, and Row Level Security means each account sees only its own rows. New sign-ups are turned off, so it stays a single-user app.

## Features
- A daily diary split into breakfast, lunch, dinner and snacks. It opens on today in local time, and a calendar jumps to any other day.
- Foods come from the Ministry of Health Tzameret database (`public/foods/moh.json`, 4,624 foods with piece and cup weights) plus foods you add yourself. Amounts can be entered in grams or in pieces.
- Saved meals (one tap adds all of their items), and "copy from yesterday" for each meal.
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

## How the data works
| Path | What |
|---|---|
| `src/db.ts` | Supabase client and data layer. Exposes `client.models.X.list/create/update/delete` for `Food`, `Entry`, `SavedMeal`, `Profile` (tables `foods`, `entries`, `saved_meals`, `profiles`), plus backup export and restore. |
| `src/lib.ts` | Loading, nutrition math and search. MoH foods are fetched from `/foods/moh.json` at runtime and never copied into the database. A `foods` row with the same id overrides a MoH food; that is how edits and "hidden" work. |
| `src/Login.tsx`, `src/main.tsx` | Magic-link sign-in, and the gate that shows the app only with a session. |
| `src/` components | `Day`, `AddDialog`, `Reports`, `Foods`, `MealEditor`, `Settings` |
| `public/sw.js` | A network-first service worker for the app shell. The data itself needs a connection. |

## Deploy
It's a static Vite site. On Vercel, use framework **Vite**, build command `npm run build`, and output directory `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as environment variables.
