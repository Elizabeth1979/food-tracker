# Food tracker

A personal Hebrew (RTL) calorie and macro diary: Vite + React + TypeScript, data in Supabase. The owner isn't a developer, so explain changes in plain words. Start with [README.md](README.md): features, setup, and the **Where it runs** table (Vercel project, Supabase project ref, Edge Function, secrets).

## Commands
- `npm run dev`: the real app on http://localhost:5173. Needs the magic-link email to sign in, which only the owner can open.
- `npm run dev:test`: **test mode** on http://localhost:5174. No sign-in, data in localStorage only, and photos get a fixed sample answer (`src/db.demo.ts`, swapped in by `vite.config.ts`). Use this to click through the UI in the browser pane yourself.
- `npm run build`: type-check and production build. Test mode never ends up in it.
- `node <script>.ts` can import `src/search.ts` directly (it has no data-layer imports) to check search ranking or the meal parser against `public/foods/moh.json`.
- `.claude/launch.json` has preview configs for all three: dev, test mode, built app.

## Deploying
Push to `main` and Vercel deploys production by itself, in about a minute. The home-screen app notices the new build through `/version.json` and reloads (`src/update.ts`). Commit and push only when the owner asks.

## Things to know
- Calories always come from the food database (`moh.json` plus the user's own `foods` rows). The photo function only names foods and guesses amounts.
- MoH foods are never copied into the database. A `foods` row with the same id overrides one; that is how edits, added units and "hidden" work.
- Schema changes: update `supabase/schema.sql` too, and record the migration name in the README table.
- The `meal-photo` function code lives in `supabase/functions/meal-photo/`. Redeploy it after changes; it reads `ANTHROPIC_API_KEY` and optional `MEAL_PHOTO_MODEL`.
