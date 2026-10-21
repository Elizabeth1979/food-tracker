# Notes

What was done in each work session and what's next. Newest first.

## 2026-10-21: camera button, quieter foods tab, goals calculator

**Done:**
- Photos: "צילום" (opens the camera, `capture="environment"`) and "מהגלריה" are separate buttons again. Android's photo picker no longer offers the camera for a plain file input, so the single button only opened the gallery. `PhotoPick` renders both, plus an optional third choice (the add window's "כתיבה").
- Foods tab: saved meals show the name and how many foods, not the full list; the food list appears only while searching.
- Settings: "חישוב לפי גובה ומשקל" (a `<details>`) works out the 4 goals from sex, age, height, weight, activity and aim (`src/goals.ts`, tested in `goals.test.ts`): Mifflin-St Jeor × activity, −20% for losing weight while building muscle, never below resting needs; protein 1.8 g/kg up to a BMI-25 weight, fat 30%, carbs the rest. It only fills the fields; "שמור יעדים" saves. The body measurements stay in localStorage on the phone (no database change).

**Next:** if the owner wants the measurements on every device or a weight log, that needs new columns: ask first.

## 2026-10-21: redesign step 4, the other tabs

**Done:**
- Foods, reports and settings each open with a page heading (`<h1>`), and their cards sit under small grey group titles, like the diary's meals. One `Group` component in `ui.tsx` (heading + optional action button + card) does this everywhere, the diary included.
- Foods: "ארוחה חדשה" and "מזון חדש" moved next to their group titles; the search box has its own name ("חיפוש במאגר").
- Reports: the CSV and PDF buttons are equal, side by side, with room around them.
- Paragraphs inside forms have no extra margins (`.form p`); the form's gap spaces them, so cards no longer start with an empty strip.

**Next:** nothing planned for the redesign; watch for anything that looks off on the phone.

## 2026-10-21: redesign step 3, the add window

**Done:**
- The list screen has two big buttons: "צילום או תמונה" (one file input without `capture`, so the phone offers camera or gallery; it was two buttons) and "כתיבה" (was a small link).
- While a photo is read (meal or nutrition label), `PhotoPick` shows that photo dimmed under a spinner with "מזהה מזונות בתמונה… / זה לוקח כמה שניות" (`role="status"`), and the typing form is a disabled `<fieldset>`. The photo is shown from a `blob:` URL, so the CSP has `img-src 'self' blob:`.
- Disabled buttons say why, in readable text linked with `aria-describedby` (`Why` in `ui.tsx`): "כתבו מה אכלתם כדי להמשיך", "אפשר להמשיך כשהזיהוי יסתיים", "כתבו כמות גדולה מאפס כדי להוסיף", "אין עדיין מזון עם כמות להוספה".
- `.form label` styles field labels only (`:not(.btn)`), so a `<label class="btn">` file button looks like a button inside forms.
- The screen test checks the loader and the reason on the locked button; giving the wrong reason on purpose made it fail.

**Next:** step 4, the other tabs (foods, reports, settings) in the same style.

## 2026-10-21: redesign step 2, the diary

**Done:**
- Date header without a card, a bigger "היום".
- Summary card: a progress ring (`Ring` in `ui.tsx`: calories toward the goal, red when over) beside the macro bars, "נצרכו X מתוך Y קק״ל". The separate calorie bar is gone (the ring shows it).
- Meals are one card under a "ארוחות" heading, a named section per meal, entries indented under the meal name with the amount in grey, and "עוד לא נרשם כלום" for an empty open meal.
- "＋ הוספה" floats at the bottom center above the tabs (`.fab`); the undo toast sits above it.
- Reports: the macro donut is the same 96px size; the meal icon in the daily breakdown has space before its name.

**Next:** step 3, the add window (photo loader over the dimmed photo, a readable "why it's disabled" line, bigger photo/type buttons), then the foods, reports and settings tabs.

## 2026-10-21: redesign step 1, the foundation (colors, font, icons)

**Done:**
- New design tokens in `styles.css` `:root`: warm neutrals, one indigo accent, macro colors sand/terracotta/slate (`--carbs`, `--fat`, `--protein`), red only for "over". Dark mode follows the phone (`prefers-color-scheme`) and redefines the same tokens. No hard-coded colors left outside the tokens (print aside).
- Rubik, self-hosted via `@fontsource-variable/rubik` (works offline). Google Fonts are gone, so the CSP is `style-src 'self'; font-src 'self'`.
- `src/icons.tsx`: one set of line icons replacing every emoji and symbol (meals, tabs, ✕, ✎, 🗑, ☆, ⇩, ＋, 📷, 🖼️, 💊). `MEALS` carries an icon name and a `short` label for the meal tabs.
- Readable minimum 14px text, 44px touch targets (`--tap`) on buttons, icon buttons, inputs and meal tabs; disabled buttons are clearly grey instead of faded. Icon-only buttons in the foods tab now have names ("עריכה: …", "מחיקה: …").

**Next:** step 2, the diary layout from the mockup (one summary card, meals as a list, floating ＋), then the add window (photo loader, "why it's disabled" line), then the other tabs.

## 2026-10-21: screen test covers the main flows, before the redesign

**Done:**
- `e2e/screens.mjs` finds everything by role and name (no CSS classes), so the redesign can't break it by renaming styles. It now covers 11 flows: one ＋, search and add, meal switch, photo review, "שכחתי משהו?", diary totals, edit amount and meal, delete and undo, save a meal and re-add it, day navigation, back button, foods tab. Breaking undo on purpose made it fail.
- Diary meal sections are named regions (`aria-label`), and delete buttons say what they delete ("מחק: ענבים…").
- Fixed a test-mode bug the test found: saving a meal showed it twice, because the demo layer's `list` returned its own array. It returns a copy now, like the real layer.
- CLAUDE.md "How we build": the owner's standards (W3C/WCAG, DRY, CSS tokens and the cascade, behavior-based tests).

**Next:** the redesign (mockup approved: Rubik, warm neutrals, one indigo accent, line icons, follows the phone's light/dark), in small steps that each pass all tests.

## 2026-10-21: a saved screen test

**Done:**
- `npm run test:screens` (`e2e/screens.mjs`, `playwright-core` + Node's test runner) clicks through the main flow in test mode at phone size: one ＋ opens on lunch at 13:00, search ענבים and add, switch to dinner, a photo opens the review list, "שכחתי משהו?" adds a regular pita, add all, and the diary has the entries under the right meals with a total. Breaking "שכחתי משהו?" on purpose made it fail, so it does catch things.
- Shipping now requires it to pass (CLAUDE.md). Vercel can't run it (no browser), so it runs in the session before merging.

**Not covered yet:** saving to Supabase and offline sync, the photo Edge Function, reports and CSV, settings and backup.

## 2026-10-21: "פיתה" finds a regular pita

**Done** (branch `claude/pita-search`):
- "פיתה" (and "פיתות") now finds the regular pita (`moh-1946`, 227 kcal) instead of toasted pita. `STAPLES` in `search.ts` maps an everyday word to its plain entry, for staples whose plain entry loses only on name length. Across all 1,667 one- and two-word names, only "פיתה" changed. Add other staples there the same way when one shows up.

## 2026-10-21: meal tabs back in the add window; add what the photo missed

**Done** (branch `claude/review-add-and-meal`, draft PR, not live yet):
- The owner couldn't change the meal: the menu in the add window's title didn't work for them. It is replaced by the four meal tabs at the top of the window (`MealSeg`, shared with the entry editor), with the time of day's meal already pressed. They stay visible on every step, and the review list's button names the meal ("הוסף לארוחת צהריים"). The title menu, its CSS and the ✕-first header order are removed.
- The photo/typed review list has "שכחתי משהו?" at the bottom: typed like a meal line ("פיתה, 2 כפות טחינה"), parsed and matched like the rest, added as more rows.

## 2026-10-21: one ＋ button, meal photo up front, most-used foods first

**Done** (branch `claude/meal-photo-button`, PR #9, not live yet):
- One "＋ הוספה" button under the day's summary replaces the four ＋ buttons on the meals. The meal comes from the time of day (`mealNow`: breakfast until 11, lunch until 16, dinner until 21, then snacks). The window's title is a menu ("הוספה ל[ארוחת צהריים ▾]") to change it. The owner said the meal doesn't matter to them, so they shouldn't have to pick it.
- Search and the ＋ list put the foods logged most often in the past 3 months first, ties by most recent (`App.tsx` counts them once at start from the cached diary; logging adds to the count). It used to be the last 40 by recency only. Favorites were considered and left out: more buttons, and frequency does the same by itself.
- Modals put ✕ first in the DOM (shown at the end by `row-reverse`), so opening one focuses ✕ and not the meal menu in the title, which Chrome always outlines.
- The ＋ screen shows "📷 צלם ארוחה" and "🖼️ בחר מהגלריה" right under the search box. A photo goes straight to recognition and the review list, with no typing screen first. Before, the photo was only behind the small "או כתבו מה אכלתם, או צלמו" link under the list, and the owner looked for it in the new-food form instead.
- The link is now "או כתבו מה אכלתם", for typing. A photo with a note still works from there.

## 2026-10-21: carrot search, and where the meal photo is

**Done** (branch `claude/search-carrot`, draft PR, not live yet):
- "גזר" finds fresh carrot first, not "גזר לבן" (parsnip). The same small tie-breaker moves 5 other plain-vegetable searches to the generic fresh version (דלעת, נבטים, כרישה, פלפל, פלפלים). Checked against all 1,667 one- and two-word names in the database: nothing else changed.
- Typed lines and meal photos: a name that exists only as an ingredient of dishes ("גזר כבוש": the database has no pickled carrot, only potato salad with carrot and pickles) now suggests the plain food ("גזר, טרי") first. The dishes stay lower in the list.

## 2026-10-20: units you can add without knowing a piece's weight

**Done** (branch `claude/fervent-heisenberg-zpz8pi`, draft PR, not live yet):
- A new unit is typed as "how many weigh how many grams": "20 מסטיק = 28 ג׳" saves one מסטיק as 1.4 g. Same row in the food's ✎ form and in the amount picker's "＋ יחידה חדשה…", with a one-line explanation above it.
- The label photo now always names the package's serving "מנה". It used to call it "יחידה", so peanut chocolate lentils got "יחידה" = 300 g (the whole bag), and the name for a single lentil was taken.

**Next:**
1. **Redeploy the `meal-photo` function** after merging (`supabase functions deploy meal-photo`), or the label fix doesn't take effect.
2. **Fix the existing food:** עדשי שוקולד עם בוטנים has "יחידה" = 300 g. In ✎, rename it "שקית" and add e.g. "<count in bag> עדשה = 300 ג׳".

## 2026-10-19: change amounts in saved meals, fold diary meals

**Done** (branch `claude/port-meal-editing`, draft PR, not live yet), ported from the upstream repo:
- Saved-meal editor: tap a food to change its amount ("עדכן כמות") instead of removing and re-adding it.
- Diary: tap a meal's header to fold or unfold it. Today, meals before the current one start folded; adding to a meal unfolds it.

## 2026-10-19: the ＋ screen and the phone's back button

**Done** (commit 954bf3d, live):
- The ＋ on a diary meal opens one list of what you usually eat *at that meal*: saved meals and foods, ordered by how often you had them there in the past month, each at last time's amount. One tap adds, a second tap takes it back out, "סיום" closes. No meal buttons and no "חזרה" links on that screen.
- The "⎘ העתק מאתמול" button is gone; the list replaces it.
- The phone's back button goes back instead of leaving the app: it closes an open window (inside the ＋ screen, it goes back one step first), and from the other tabs it returns to the diary.
- Only the diary flow changed. The מזונות tab's own add-food window looks as it did before, on purpose.
- The GitHub repo is now public. No keys or passwords are in it.

**Next:**
1. **Try the back button on your Android phone.** It was tested only with Esc on a computer, which uses the same browser mechanism. It needs Chrome 120 or newer.
2. **Coffee search picks dry powder.** Typing "2 כפות קפה שחור" in the typing box matches instant coffee powder (about 106 kcal), and "ספל קפה שחור" about 880 kcal. It should match a cup of prepared coffee (`moh-4803`, a few kcal). Still true after today's search fixes. Until it's fixed, add coffee from the ＋ list or search "טורקי".
3. **Changing an amount:** a usual item goes in at last time's amount. To change it, tap the item in the diary.
4. Small things noticed, not asked for: the design checker flags the calorie bars for animating their width (`styles.css`). The day summary's micronutrient line (נתרן, סידן…) is busy for a daily view.
