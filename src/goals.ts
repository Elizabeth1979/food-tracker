// Daily goals from body measurements. No data-layer imports, so tests can run it directly.
export type Body = { sex: 'f' | 'm'; age: number; heightCm: number; weightKg: number; activity: number; aim: number };
export type Goals = { kcal: number; carbs: number; fat: number; protein: number };

export const ACTIVITY: [string, number][] = [['בלי אימונים', 1.2], ['1–3 אימונים בשבוע', 1.375], ['4–5 אימונים בשבוע', 1.55], ['אימון כמעט כל יום', 1.725]];
export const AIMS: [string, number][] = [['לרדת במשקל ולבנות שריר', -0.2], ['לשמור על המשקל ולבנות שריר', 0], ['לעלות במסת שריר', 0.1]];

export const PROTEIN_PER_KG = 1.8, CARBS_MAX = 130;
// The weight protein is counted on: up to a BMI-25 weight, so extra body fat doesn't inflate it.
export const proteinKg = (weightKg: number, heightCm: number) => Math.min(weightKg, Math.round(250 * (heightCm / 100) ** 2) / 10);

export function suggestGoals({ sex, age, heightCm, weightKg, activity, aim }: Body): Goals {
  // Mifflin-St Jeor resting energy, times activity, then the aim's deficit or surplus.
  const rest = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161);
  // Never below resting needs: too deep a deficit costs muscle.
  const kcal = Math.round(Math.max(rest * activity * (1 + aim), rest) / 10) * 10;
  // Protein for building muscle.
  const protein = Math.round(PROTEIN_PER_KG * proteinKg(weightKg, heightCm));
  // Carbs: what's left after protein and 30% fat, but low-carb (130 g at most); fat takes the rest.
  const carbs = Math.max(0, Math.min(CARBS_MAX, Math.round((kcal * 0.7 - protein * 4) / 4)));
  const fat = Math.round((kcal - protein * 4 - carbs * 4) / 9);
  return { kcal, carbs, fat, protein };
}
