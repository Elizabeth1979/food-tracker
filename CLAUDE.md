# Food tracker

A personal Hebrew (RTL) calorie and macro diary: Vite + React + TypeScript, data in Supabase. The owner isn't a developer, so explain changes in plain words. Start with [README.md](README.md): features, setup, and the **Where it runs** table (Vercel project, Supabase project ref, Edge Function, secrets). [NOTES.md](NOTES.md) has what each work session did and what's next; add a short entry at the top when a session ends.

## Commands
- `npm run dev`: the real app on http://localhost:5173. Needs the magic-link email to sign in, which only the owner can open.
- `npm run dev:test`: **test mode** on http://localhost:5174. No sign-in, data in localStorage only, and photos get fixed sample answers, a meal and a nutrition label (`src/db.demo.ts`, swapped in by `vite.config.ts`). Use this to click through the UI in the browser pane yourself.
- `npm run build`: type-check and production build. Test mode never ends up in it.
- `npm test`: type-checks and runs `src/*.test.ts` with Node's own test runner (no packages). `src/search.test.ts` holds search ranking and the meal parser to their promises against the real `moh.json`. Vercel runs it before every build (`vercel.json` `buildCommand`), so a failing test blocks the deploy. When a ranking change is meant to change results, update the test in the same commit.
- `npm run test:screens`: the screen test (`e2e/screens.mjs`). Starts test mode itself and clicks through the main flow at phone size with touch: one ＋, search and add, switch meal, photo to review list, "שכחתי משהו?", then checks the diary. Not run by Vercel (no browser there); run it before shipping. Needs a Chromium: `npx playwright install chromium`, or set `CHROMIUM_PATH` (in Claude's cloud sessions: `/opt/pw-browsers/chromium-*/chrome-linux/chrome`). When a change alters this flow, update the test in the same commit.
- `node <script>.ts` can import `src/search.ts` directly (it has no data-layer imports) to check search ranking or the meal parser against `public/foods/moh.json`.
- `.claude/launch.json` has preview configs for all three: dev, test mode, built app.

## Deploying
Push to `main` and Vercel deploys production by itself, in about a minute. The home-screen app notices the new build through `/version.json` and reloads (`src/update.ts`).

**Ship without asking (the owner's standing rule).** For changes to the app, commit, push, open the PR, merge it and deploy it yourself once all of these hold: `npm test`, `npm run test:screens` and `npm run build` pass, and you clicked the change through in test mode (`npm run dev:test`) at phone size with touch taps. Then tell the owner, in plain words, that it's live and what changed. If something turns out wrong, roll back (Vercel: promote the previous production deployment) and tell them.
**Still ask first** for: database changes (schema, migrations, editing or deleting stored rows), anything that costs money or changes a paid service (the photo AI model, Supabase/Vercel plans, secrets), and deleting anything.

**After merging to `main`, start the production deploy yourself; don't wait for Vercel's GitHub hook** (the owner's standing request: Vercel has picked up merges 15+ minutes late or not at all). With the Vercel tools: create a deployment with `target: "production"` and `gitSource` `{type: "github", org: "Elizabeth1979", repo: "food-tracker-elli", ref: "main", sha: <merge commit>}` in project `prj_GF3n2aiehutDd5I6h01bhCICGhJz`, team `team_IluAXBY7tqQpBwOf1hRuqt6a`. It builds in under a minute and takes over `food-tracker-nine-khaki.vercel.app`; check it reaches READY and tell the owner it's live. A second build from the late hook is harmless.

## Things to know
- Calories always come from the food database (`moh.json` plus the user's own `foods` rows). A meal photo only names foods and guesses amounts. The one exception is label scanning (`mode: 'label'`, the new-food form's "צלם טבלת ערכים"): it fills a new food from a package's nutrition table, and the user checks it before saving.
- MoH foods are never copied into the database. A `foods` row with the same id overrides one; that is how edits, added units and "hidden" work.
- Offline (`src/db.ts`): lists are kept in localStorage per user, and writes made offline queue in `pending` and are replayed in order by `syncPending` (on start, `online`, and when the app comes back to the front). While anything is queued, new writes queue behind it. Ids are made on the device, so a replayed create keeps its id, and a duplicate (23505) counts as sent. A request with status 0 means no answer; anything Supabase refuses still throws. Offline, `main.tsx` keeps the last signed-in user instead of showing Login. `App` shows a "waiting to send" line while `hasPending()` (it listens for `pending-changed`) and fetches the past 7 days on start and on `online`, so they're kept for offline.
- Security headers live in `vercel.json`. A new outside origin (API, font, image) means widening the CSP on purpose. Camera is left out of Permissions-Policy so photo capture keeps working.
- Schema changes: update `supabase/schema.sql` too, and record the migration name in the README table.
- The `meal-photo` function code lives in `supabase/functions/meal-photo/`. Redeploy it after changes; it reads `ANTHROPIC_API_KEY` and optional `MEAL_PHOTO_MODEL`.
