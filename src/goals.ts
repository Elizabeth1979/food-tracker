// Daily goals from body measurements. No data-layer imports, so tests can run it directly.
export type Body = { sex: 'f' | 'm'; age: number; heightCm: number; weightKg: number; activity: number; aim: number };
export type Goals = { kcal: number; carbs: number; fat: number; protein: number };

export const ACTIVITY: [string, number][] = [['בלי אימונים', 1.2], ['1–3 אימונים בשבוע', 1.375], ['4–5 אימונים בשבוע', 1.55], ['אימון כמעט כל יום', 1.725]];
export const AIMS: [string, number][] = [['לרדת במשקל ולבנות שריר', -0.2], ['לשמור על המשקל ולבנות שריר', 0], ['לעלות במסת שריר', 0.1]];

export function suggestGoals({ sex, age, heightCm, weightKg, activity, aim }: Body): Goals {
  // Mifflin-St Jeor resting energy, times activity, then the aim's deficit or surplus.
  const rest = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161);
  // Never below resting needs: too deep a deficit costs muscle.
  const kcal = Math.round(Math.max(rest * activity * (1 + aim), rest) / 10) * 10;
  // Protein for building muscle: 1.8 g per kg, counted up to a BMI-25 weight so extra body fat doesn't inflate it.
  const m = heightCm / 100;
  const protein = Math.round(1.8 * Math.min(weightKg, 25 * m * m));
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, carbs, fat, protein };
}
