# Notes

What was done in each work session and what's next. Newest first.

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
