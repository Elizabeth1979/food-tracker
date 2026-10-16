# יומן תזונה — Food Tracker

A personal calorie and macro diary in Hebrew (right-to-left) for mobile and desktop.

**Local-only.** It has no backend, no login and no server. Everything you log stays in this browser's IndexedDB, on this device. After the first visit the app also works offline.

## Features
- A daily diary split into breakfast, lunch, dinner and snacks. It opens on today in local time, and a calendar jumps to any other day.
- Foods come from the Ministry of Health Tzameret database (`public/foods/moh.json`, 4,624 foods with piece and cup weights) plus foods you add yourself. Amounts can be entered in grams or in pieces.
- Saved meals (one tap adds all of their items), and "copy from yesterday" for each meal.
- Daily goals (default 2000 kcal, 250 g carbs, 65 g fat, 100 g protein), a calorie and macro donut, and weekly or monthly reports. Any date range exports to CSV, or to PDF through the print dialog ("Save as PDF").
- Backup and restore as a JSON file (Settings → גיבוי).

## Backups matter
Your data lives in one browser on one device. **Clearing site data, using private browsing, uninstalling the browser or switching devices loses it.** The app asks the browser for persistent storage, but that is not a backup.

- Download a backup regularly: Settings → **הורדת גיבוי**.
- To move to another device or browser, download a backup there and use **שחזור מגיבוי**. Restoring **replaces** all data in that browser.

## Run it
Requires Node 20 or later.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

## How the data works
| Path | What |
|---|---|
| `src/db.ts` | IndexedDB store (via `idb-keyval`): one key per table (`Food`, `Entry`, `SavedMeal`, `Profile`), cached in memory. Exposes `client.models.X.list/create/update/delete`, plus backup export and restore. |
| `src/lib.ts` | Loading, nutrition math and search. MoH foods are fetched from `/foods/moh.json` at runtime and never copied into the DB. A local `Food` row with the same id overrides a MoH row; that is how edits and "hidden" work. |
| `src/` components | `Day`, `AddDialog`, `Reports`, `Foods`, `MealEditor`, `Settings` |
| `public/sw.js` | A network-first service worker, so the app opens offline |

## Deploy
It's a static Vite site, so any static host works. On Vercel, use framework **Vite**, build command `npm run build` and output directory `dist`.
