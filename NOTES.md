# Notes

What was done in each work session and what's next. Newest first.

## 2026-10-21: one ＋ button, meal photo up front, most-used foods first

**Done** (branch `claude/meal-photo-button`, PR #9, not live yet):
- One "＋ הוספה" button under the day's summary replaces the four ＋ buttons on the meals. The meal comes from the time of day (`mealNow`: breakfast until 11, lunch until 16, dinner until 21, then snacks). The window's title is a menu ("הוספה ל[ארוחת צהריים ▾]") to change it. The owner said the meal doesn't matter to her, so she shouldn't have to pick it.
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
