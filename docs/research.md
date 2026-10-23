# Research log

Every study or source the app relies on: what it found, and what we changed because of it. Newest first.
Add an entry when research changes the app or the guide (`src/articles/`). Say how sure we are: a conference abstract is not a peer-reviewed paper.

## 2026-10-23: the guide's sources (`src/articles/`)
The five in-app articles, checked against these. Cloud sessions can't open most of these sites directly, so the numbers were checked through search results quoting them; recheck against the full text when one matters.
- **Israeli nutrition labelling:** [תקנות הגנה על בריאות הציבור (מזון) (סימון תזונתי), התשע״ח־2017](https://www.nevo.co.il/law_html/law01/501_734.htm) (in force 2020; energy in kcal, sodium in mg, sugars also as teaspoons) and the [MoH red-label page](https://efsharibari.health.gov.il/governance/regulation/unhealthy-food-labeling-law/). Sources disagree on the red label's second-stage sodium limit (400 or 500 mg/100 g), so the article gives no thresholds. The "per 100 g is mandatory" rule wasn't confirmed from the text; the article only says the table has a 100 g column.
- **Protein:** [NAM DRIs](https://nap.nationalacademies.org/catalog/10490) (RDA 0.8 g/kg), [EFSA](https://www.efsa.europa.eu/en/press/news/120209) (0.83 g/kg), [PROT-AGE, Bauer 2013](https://doi.org/10.1016/j.jamda.2013.05.021) (over 65: 1.0–1.2 g/kg, 1.2–1.5 when ill), [Leidy 2015](https://pubmed.ncbi.nlm.nih.gov/25926512/) (weight loss: 1.2–1.6 g/kg, 25–30 g a meal), [ISSN 2017](https://doi.org/10.1186/s12970-017-0177-8) (training: 1.4–2.0), [Morton 2018](https://pubmed.ncbi.nlm.nih.gov/28698222/) (49 studies: gains level off near 1.6). The app's 1.8 g/kg sits inside ISSN's range. `GoalsInfo` (`ui.tsx`) still says 1.6–2.2 for strength training; 2.2 wasn't confirmed this time.
- **Portion estimation:** [Lucassen 2021](https://pubmed.ncbi.nlm.nih.gov/33761165/) (40 people, one weighed lunch: only 50% of text-aided and 35% of photo-aided estimates within 25%); [Timon 2018](https://doi.org/10.1007/s12603-017-0937-9) (older and younger adults vary widely, nutritionists less; amorphous foods overestimated, large pieces underestimated).
- **A spoon of oil:** Tzameret's כף שמן זית is 10 g (88 kcal); USDA's tablespoon is 13.5 g (119 kcal), a level 15 ml measuring spoon. The guide says both. No app change.

## 2026-10-23: calories must fit the macros (PR #57)
- **Source:** the energy conversion factors in [EU Regulation 1169/2011, Annex XIV](https://www.legislation.gov.uk/eur/2011/1169/annex/XIV): protein 4, carbohydrate 4, fat 9, alcohol 7, fibre 2, polyols 2.4, erythritol 0 kcal/g (the Atwater system).
- **Changed:** `kcalOff` in `search.ts` warns before saving a food whose calories are off 4/4/9 by more than 25% and 20 kcal. It caught the owner's cottage cheese scan (sodium 350 read as calories). Known false alarm: drinks with alcohol (beer: 43 kcal, 16 from its macros).

## 2026-10-23: vitamin and mineral targets (PR #58)
- **Source:** the US FDA's [Daily Values](https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels) for nutrition and supplement labels (adults, 2000 kcal).
- **Changed:** `DAILY_VALUES` in `goals.ts`: a row per nutrient against its label value; sodium as a limit (2300 mg).

## 2026-10-23: photo apps miss hidden fat (PR #54)
- **Source:** NIDDK/NIH, presented at NUTRITION 2026 (American Society for Nutrition, July 25–28 2026): 102 meals from a metabolic kitchen, every ingredient weighed, run through MyFitnessPal, Lose It!, Cal AI and Appediet. All four underestimated by about 250–345 kcal and ~30 g fat a meal (about a third); carbs were close; ketogenic meals were worse. A conference abstract, not yet a peer-reviewed paper. Coverage: [ScienceDaily](https://www.sciencedaily.com/releases/2026/07/260726015237.htm), [Newswise](https://www.newswise.com/articles/photo-based-calorie-tracking-apps-may-underestimate-energy-in-meals), [Medscape](https://www.medscape.com/viewarticle/photo-based-meal-apps-underestimate-calories-and-fat-2026a1000qo9).
- **Changed:** `meal-photo` (v8) adds the oil, dressing, butter or sauce it can't see as its own row in spoons, marked as a guess and included by default. Not for foods named as fried (their oil is in the database). Also the guide article "למה תמונה מפספסת קלוריות".
- **Not built yet** (same research): a weekly calorie target adapted from weigh-ins; "what can I still eat".

## 2026-10-22: goals from the body (PRs #20, #28, #31)
- **Sources:** default goals are the FDA nutrition-label Daily Values (2000 kcal, protein 50 g, carbs 275 g, fat 78 g). Resting energy: [Mifflin–St Jeor (1990)](https://pubmed.ncbi.nlm.nih.gov/2305711/). Protein: NAM RDA and the [ISSN 2017 position stand](https://doi.org/10.1186/s12970-017-0177-8). Carbs: the Dietary Guidelines for Americans (45–65% of calories).
- **Changed:** `goals.ts`: protein 1.8 g/kg counted up to a BMI-25 weight, no protein goal until a weigh-in, carbs a soft limit with low-carb plans (130/100/50 g), fat ≥ 20% of calories. `GoalsInfo` in `ui.tsx` explains them with these sources.

## Food data: the Ministry of Health's Tzameret database
- **Source:** משרד הבריאות, מאגר צמרת: 4,624 foods with calories, macros, sodium, calcium, potassium, B12, and piece, spoon and cup weights (`public/foods/moh.json`).
- **Changed:** all calories in the app come from it or from the user's own foods; a photo only names foods and guesses amounts. Gap: the full file has vitamin C, iron, magnesium and more, not in `moh.json` yet (data.gov.il is blocked from cloud sessions).
