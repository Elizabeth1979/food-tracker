// Goals from body measurements. Run: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestGoals, type Body } from './goals.ts';

const her: Body = { sex: 'f', age: 45, heightCm: 165, weightKg: 75, activity: 1.375, aim: -0.2 };

test('losing weight while building muscle: a modest deficit, high protein, macros adding up to the calories', () => {
  const g = suggestGoals(her);
  const keep = suggestGoals({ ...her, aim: 0 });
  assert.ok(g.kcal < keep.kcal && g.kcal >= keep.kcal * 0.75);
  assert.equal(g.protein, 123); // 1.8 g/kg of a BMI-25 weight (68 kg), not of all 75 kg
  assert.ok(Math.abs(g.carbs * 4 + g.fat * 9 + g.protein * 4 - g.kcal) < 15);
});

test('never below resting needs, and more weight or training means more food', () => {
  const sitting = suggestGoals({ ...her, activity: 1.2 });
  assert.ok(sitting.kcal >= 10 * 75 + 6.25 * 165 - 5 * 45 - 161 - 5);
  assert.ok(suggestGoals({ ...her, activity: 1.55 }).kcal > suggestGoals(her).kcal);
  assert.ok(suggestGoals({ ...her, weightKg: 85 }).kcal > suggestGoals(her).kcal);
});
