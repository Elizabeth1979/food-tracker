# Notes

What was done in each work session and what's next. Newest first.

## 2026-10-23: the add window: foods and saved meals in one list

**Done:**
- The owner wanted one list, not "הרגילים שלך" and "ארוחות שמורות" apart. Now one list, most logged this past month first (at any meal), then most recent. 10 shown (was 5), up to 30 foods plus every saved meal behind "עוד".
- A saved meal now counts the meals that had all its foods (it used to average its foods' counts, so a meal with tea in it ranked as high as tea). It's marked with the utensils icon (and "ארוחה שמורה" for screen readers); the hint line explains the icon.
- Screen test: six typed foods + the saved meal, one list, 10 shown, the rest behind "עוד", no separate saved-meals group. Fails with the old two lists.

## 2026-10-23: the photo guesses hidden oil and sauce

**Done:**
- Research (NIH-linked study, July 2026) found photo calorie apps miss 250–345 kcal a meal, mostly fat they can't see. `meal-photo` (v8) now adds the frying oil, dressing, butter or sauce as its own item in spoons with `hidden: true`, under a plain name the database matches ("שמן זית", "חמאה", "טחינה"); not for foods it names as fried, whose oil the database already counts.
- The review list marks such a row "ניחוש: שמן או רוטב שלא רואים בתמונה…" so the owner fixes the amount or removes it. It's included by default, since leaving fat out is the known error. Test mode's photo answer has a guessed olive oil; the screen test sees the note and removes it.

**Next:** the owner chose "numbers I don't trust" as the main pain. Other ideas from the same research, not built: weekly adaptive calorie target from weigh-ins (no AI cost; asks before changing goals), "what can I still eat" from usual foods.

## 2026-10-23: a meal's photo moves with its last food

**Done:**
- Moving a meal's last food to another meal (tap the entry, change the meal) left the photo on the empty meal. `Day.tsx` now moves it along (`movePhoto` in `lib.ts`: Storage `move`, renaming `<meal>.<id>.jpg`; the existing `own_meal_photos` policy is `for all`, so no database change). One helper, `photosLeft`, decides for both delete and move.
- Screen test: move the foods one by one, the photo stays until the last, then is at dinner, still after a reload. Fails without the fix.

## 2026-10-23: the add window's usual foods: one list at every meal

**Done:**
- The owner wants the meal picked from the time of day, but the list itself fixed: "הרגילים שלך" (was "…בצהריים") now ranks foods and saved meals by how often they were logged this past month at any meal, then by recency. Switching the meal no longer reorders it. Top 12 by that count (was: 12 most recent, re-sorted).
- Screen test: a cucumber logged once at breakfast; the list is identical at lunch, breakfast, dinner and snacks, grapes (logged most) first. Fails with the old per-meal count.

## 2026-10-23: the app's own confirm and prompt windows

**Done:**
- The browser's `confirm()`/`prompt()` boxes (site address, "Cancel/OK") are gone: `confirmIt`/`promptIt` + `AskHost` in `ui.tsx` show a small app-styled `Modal` instead. Used for deleting a photo, naming a saved meal, hiding a food, deleting a saved meal, restoring a backup.
- Screen tests tap the app's buttons (cancel keeps the photo) and fail if any browser dialog opens.

## 2026-10-23: deleting a meal's last food takes its photo

**Done:**
- The owner deleted the only food in dinner and the meal photo stayed, over "עוד לא נרשם כלום". Photos aren't linked to entries (no table), so `Day.tsx` now hides the meal's photos when its last food is deleted, says so in the undo toast ("נמחק עם תמונת הארוחה", now `role="status"`), and deletes them for good once the 6-second undo passes. Undo brings both back.
- Screen test for it (fails without the fix). CLAUDE.md: every reported bug gets a test that reproduces it.


## 2026-10-23: a photo's potato: boiled is boiled, "מעוך" is פירה

**Done:**
- The owner photographed one boiled potato. The photo AI listed it twice ("מבושל" and "מעוך"), "מבושל" matched *fried* potatoes (185 kcal/100 g instead of 86), and "מעוך" matched nothing.
- `search.ts`: "מטוגנים" and words like "ושמן" now count as processed, so plain boiled ranks first; `SAME` maps מעוך → פירה; `matchFoods` drops unknown words from the end instead of leaving a row unmatched (`splitAnd` still checks the exact phrase). Test in `search.test.ts`.
- `meal-photo` prompt: each food once (a cut or squashed potato is one item), mashed potato is "פירה". Function redeployed.

## 2026-10-23: "שכחתי משהו?" offers foods as you type

**Done:**
- In the photo/typed review list, typing in "שכחתי משהו?" now lists up to 5 matching foods under the field (for the last item typed); tapping one adds it with the amount typed ("2 עגבני" → 2 tomatoes). "הוסף" still adds a whole typed line. `FoodHits` in `Review.tsx` is shared with the row's "חיפוש מזון אחר…". The owner typed "עגבני" and had no list to choose from.

## 2026-10-23: photo amounts no longer blown up

**Done:**
- The owner's photos came back as 4 lettuces (2.6 kg) and 6 medium potatoes for two leaves and a few small potatoes. The cause was mostly the app: the model said "4 יחידה" meaning leaves, and `unitFor` turned a bare "יחידה" into the food's medium whole unit (a 648 g head).
- `meal-photo` (v7) now also returns `grams`, its weight guess per item, and the prompt says a יחידה is a whole item, count only what's visible, judge size against the plate, guess smaller when unsure.
- `unitFor` checks the unit against `grams`: more than 1.6× off, it takes the food's unit that fits the same count (4 × "עלה" of 11 g), else the grams themselves. Typed text has no `grams`, so it's unchanged. Tested in `search.test.ts` with the owner's lettuce, potatoes and schnitzel.

**Next:** if photos still misjudge sizes, a stronger model (`MEAL_PHOTO_MODEL`) is the next lever; it costs more per photo, so ask first.

## 2026-10-23: vitamins out of the way while adding

**Done:**
- The owner found the vitamin line while adding food confusing and incomplete. `NutLine` (amount picker, review list, meal editor) now shows calories and macros only. Vitamins show in a food's details in the מזונות tab (`MicroLine` under `FoodSummary`) and in the day summary folded as "ויטמינים ומינרלים היום" (`MicroLine` with `label` is now a `<details>` with a note that MoH foods carry only sodium, calcium, potassium and B12). Reports unchanged.

**Next:** the MoH database has more vitamins than the four the app loads; adding them would complete the picture for food.

## 2026-10-23: supplements and all their vitamins

**Done:**
- `foods.extra` / `entries.extra` (jsonb, migration `extra_vitamins`): other vitamins and minerals by "name (unit)", names from `VITAMINS` in `lib.ts`. `scale`, `sum` and `pickItem` carry them, so amounts, day totals, report averages (now `scale(sum, 1/days)`) and CSV columns include them; `MicroLine` lists them after the four columns.
- Label reading (`meal-photo` v6, deployed): the app sends `names: VITAMINS`; supplement labels with only a per-tablet column and no weight come back per piece (`basisG: 1`, unit טבליה/כמוסה = 1 g) with `extra`. IU converted in the prompt.
- ＋ window: "מוצר ארוז או תוסף? צילום התווית" opens the new-food form, then the amount. The form shows `extra` fields and a "ויטמין או מינרל נוסף" picker. The day summary has a "ויטמינים ומינרלים" line (`MicroLine` with `label`).
- Test mode's label answer is now a multivitamin; the screen test reads it, adds magnesium by hand, logs 2 tablets and checks the day line.

**Next:** no daily targets for the new vitamins yet (only B12 has one). Not tried on a real supplement label yet.

## 2026-10-23: water tracking

**Done:**
- `WaterLine` (in `ui.tsx`) under the macro rows: "מים 0.75 / 2 ליטר" with "פחות כוס מים" / "עוד כוס מים". A glass is a normal entry (`WATER` in `lib.ts`: moh-9593, 250 g, 0 kcal) at the current meal; `isWater` (the plain MoH waters) keeps them off the meal lists and out of "שמור כארוחה". "פחות" deletes the latest glass with the usual undo. Goal fixed at 2 L (`WATER_GOAL_ML`); no database change.

## 2026-10-23: photos in the backup

**Done:**
- "הורדת גיבוי" adds `Photo: [{ path: "<date>/<meal>.<id>.jpg", jpeg: base64 }]` (`exportPhotos` in `lib.ts`); "שחזור מגיבוי" uploads them back with upsert (`restorePhotos`) and keeps photos already there. Older backups without `Photo` restore as before. Test mode keeps photos in localStorage now, so a restore's reload keeps them; the screen test downloads a backup, deletes the photo, restores, and sees it back.

## 2026-10-23: meal photos kept in the diary

**Done:**
- A photo whose foods are added is saved with the meal (`savePhoto` in `lib.ts`, after "הוסף ל…" in the review list) and shown in the diary as a square above that meal's foods; tap opens it with "מחק תמונה". Storage bucket `meal-photos` (private, JPEG, 2 MB max), path `<user>/<date>/<meal>.<id>.jpg`, so no table; migration `meal_photos_bucket`. CSP `img-src` now allows the Supabase origin for the signed URLs. Test mode keeps photos in memory.

**Next / limits:** offline, a photo isn't saved (the error banner says so) and the diary shows none. Moving a meal's entries to another meal leaves the photo where it was.

## 2026-10-23: usual foods at another amount

**Done:**
- In the add window's "הרגילים שלך", each food row is now two buttons: ＋ adds at last time's amount (tap again takes it back), and the name opens the amount picker filled with last time's amount (`Pick` with `onOpen` in `AddDialog.tsx`). Saved meals stay one tap. A row shows what this visit added, so after adding 2 tomatoes it says 2. (The owner wanted 2 tomatoes where the list offered 1.)

## 2026-10-22: a note with every photo

**Done:**
- A picked or taken meal photo isn't read straight away: it shows with "הערה (לא חובה)" and "זהה מזונות" / "תמונה אחרת" (`PhotoNote` in `AddDialog.tsx`). The note goes to the model, which already trusts it over the photo. `usePhotoUrl` in `ui.tsx` is shared with the reading spinner.

## 2026-10-22: review list can search any food

**Done:**
- In the photo/typed review list, each food's picker has "חיפוש מזון אחר…": it turns the row into a search over the whole database (5 results), and picking one replaces the food with its amount re-suggested. Rows with no match get a "חיפוש" button too. (The owner's photo showed grated Bulgarian cheese as yellow cheese, and the picker only offered yellow cheeses.)

## 2026-10-22: foods tab rows show just the name

**Done:**
- Each food and saved meal is one line: its name (a `<details>`; tapping it shows the values or the meal's foods, with עריכה / הסתרה or מחיקה) and a ＋ that adds to the diary. Lists, search results included, show 5 at a time ("הצג עוד", then "הצג פחות"). `ItemRow` and `Fold` in `Foods.tsx`.

## 2026-10-22: foods tab buttons

**Done:**
- "מזון חדש" and "ארוחה חדשה" are primary (blue) buttons, as on the other screens; they were white and hard to see.

## 2026-10-22: foods tab in order

**Done:**
- The foods tab starts with the search box, so typing shows results right under it; while searching only the results show (with "מזון חדש"). Without a search: "המזונות שלי (N)" (foods the user added or edited, `source !== 'moh'`) and "ארוחות שמורות (N)", each showing 5 with "הצג הכל". The MoH database is only reached by search.
- Then: one tap on a saved meal in the foods tab adds it to the diary's day at the meal of the time of day, with a 6-second "בטל" toast; a food tap opens the amount picker as before.

## 2026-10-22: Settings, one clear place to start

**Done:**
- Settings opens with "היעדים שלך": the current goals in one line, whether they're general or tailored, the primary "התאמה אישית" button and a small "עריכה ידנית" link. Manual editing warns when carbs+fat+protein don't add up to the calories (within 10%).
- Tailoring is a 4-step window (`Tailor.tsx`): body (incl. weight, prefilled from the last weigh-in), activity and aim, carb plan (radios), summary with the arithmetic → "השתמש ביעדים האלה". A changed weight is saved as today's weigh-in.
- The weigh-in moved to Reports, above the weight chart; it never changes goals. Shared `saveWeight` in `lib.ts`.

## 2026-10-22: clearer ＋ list, gum is a יחידה

**Done:**
- The ＋ screen's list has titles: "הרגילים שלך ב<meal>" (5 foods, "עוד N" for the rest, with "לחיצה מוסיפה בכמות של הפעם הקודמת") and "ארוחות שמורות" as its own group, instead of one mixed list with an unexplained star.
- Label scanning names the serving "יחידה" when the label says it is one piece (a gum, a bar), otherwise still "מנה" (`servingIsPiece`). `meal-photo` redeployed (version 5).

## 2026-10-22: fat back on the diary

**Done:**
- At the owner's request fat is back as the diary's third row, "X / 78 ג׳", for reference only (no green/amber: too little fat is as bad as too much). `DAY_GOALS` has `kind: 'min' | 'max' | 'ref'`.

## 2026-10-22: general defaults, tailoring on request

**Done:**
- Defaults for everyone are the nutrition-label Daily Values (2000 kcal, protein 50, carbs 275, fat 78; `DEFAULT_GOALS`, and `goalsOf` fills any empty goal with them). Without body details the diary says "יעדים כלליים, לא מותאמים לגוף שלך" with a link to tailor.
- Settings: "שקילה" only logs weight (never changes goals). "התאמת היעדים" takes sex, age, height, activity, aim and a carb plan (standard / 130 / 100 / 50, stored in `body.carbsMax`), uses the latest weigh-in, names what's missing, shows each suggested goal with its arithmetic in the user's numbers, and applies them only on "השתמש ביעדים האלה".
- Replaces the weigh-in prompt from earlier today.

## 2026-10-22: no made-up protein goal

**Done:**
- Protein needs body weight, so it's never guessed: new profiles start without a protein goal (and carbs 130), and while there is none the diary's protein row shows "הזינו משקל כדי לקבוע יעד חלבון", which opens Settings with the weigh-in unfolded (`open={!p?.protein}`). The screen test starts from that state and checks the goal appears after the weigh-in.

## 2026-10-22: smaller add button, carbs goal 130

**Done:**
- The ＋ button sizes to its label (48px tall, lighter shadow) instead of filling the row, so the ring is the one focal point.
- At the owner's request, set their stored carbs goal to 130 (`profiles.carbs`). Their protein goal is empty (null), so the diary shows no protein target until a weigh-in or a value in Settings.

## 2026-10-22: "איך נקבעו היעדים?"

**Done:**
- Under the diary's two goals, a disclosure explains them: protein by body weight (1.8 g/kg, counted up to a BMI-25 weight, with the owner's own numbers after a weigh-in), carbs as a soft limit, why fat has no goal, and two guidance tables with sources (`GoalsInfo` in `ui.tsx`). The formula's numbers come from `goals.ts` (`PROTEIN_PER_KG`, `CARBS_MAX`, `proteinKg`), so the text can't drift from the math.

## 2026-10-22: diary shows protein and carbs only

**Done:**
- At the owner's request the diary summary shows two goals: protein first, a minimum ("לפחות", green ✓ once reached), and carbs, a soft limit ("עד", green under it, amber "מעל היעד" over). Fat and micros left the diary; Reports still shows them (`DayGoals` in `ui.tsx`).
- `suggestGoals` is low-carb now: carbs at most 130 g, fat takes the rest of the calories. The owner's stored carbs goal (250) still needs changing to 130 in Settings or by a weigh-in.

## 2026-10-22: summary card, more air

**Done:**
- The calorie ring is bigger (140px, thinner line, 32px number) and the ＋ button shorter (56px), so the two are better balanced and "2000" no longer touches the ring. More space between the macro rows, under "נצרכו", and above the micros (`styles.css`).

## 2026-10-21: Settings order

**Done:**
- At the owner's request "יעדים יומיים" is first (its save is the primary button); the weigh-in and calculator moved under "חישוב לפי משקל", folded in a "שקילה ועדכון היעדים" disclosure, closed by default. The hint text is shorter. The screen test opens the disclosure before weighing in.

## 2026-10-21: diary top, less crammed

**Done:**
- At the owner's request the "הוספה" button moved from floating over the list to the top of the summary card, beside the ring (`.summary-top`). The calories line, nutrient bars and micros now run full width under them, so nothing is squeezed next to the ring. The floating `.fab` and its extra bottom padding are gone.
- Noticed on the owner's screenshot: the protein goal is empty in their profile (the protein row shows no "/ goal"). A weigh-in or "שמור יעדים" in Settings fills it.

## 2026-10-21: new app icon

**Done:**
- The owner picked a curvy hourglass figure: two white curves (shoulders, waist, hips) on indigo, with golden sand gathering at the bottom. `public/icon.svg` is the source; `icons/icon-192/512.png` (rounded), `icon-maskable-512.png` (full bleed, art inside the safe zone) were rendered from it.
- The 4 long-press shortcut icons are now the app's own line icons (sunrise, sun, moon, star) in white on indigo, instead of the old emoji-style pictures.
- On the phone: Android refreshes the home-screen icon by itself within about a day, or at once after removing the app and adding it again; iPhone needs remove and add.

## 2026-10-21: waist measurement

**Done:**
- The owner builds muscle while losing fat, so the scale alone can stand still. Weigh-ins now take an optional waist (cm) next to the weight (migration `weights_waist`, approved).
- Reports: one `TrendChart` draws both the weight and the waist over the range, each with the change in words.
- The screen test enters a waist on both weigh-ins and finds the waist chart by name; dropping the waist on save made it fail.

**Next:** body fat % only if the owner gets a scale that shows it (asked, no answer yet).

## 2026-10-21: weight log

**Done:**
- Database (migration `weight_log`, approved by the owner): a `weights` table (date, kg; RLS like the others) and `profiles.body` (sex, birth year, height, activity, aim). `Weight` is one more model in `db.ts` (offline queue, backup and restore included) and in test mode.
- Settings: "משקל ויעדים" card. Type today's weight and tap "שמור משקל ועדכן יעדים": the weigh-in is saved (one per day; a second one that day replaces it), the body details are saved to the profile, and the 4 goals are recalculated and saved from the new weight. The details sit in a "פרטים לחישוב" disclosure, open until filled once. The calculator's old on-phone copy (localStorage `body`) seeds the form once. Manual "שמור יעדים" still works.
- Reports: a weight line chart for the chosen range (2+ weigh-ins), with the change in words ("ירידה של 1.8 ק״ג"); a signed number flipped in RTL.
- The screen test weighs in a week ago and today, checks the goals follow, and finds the chart by its accessible name; breaking the goal update or the saved details made it fail.

**Next:** watch that the owner weighs in weekly; if the trend stalls 3–4 weeks, the aim or activity may need changing.

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
