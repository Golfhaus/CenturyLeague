import { clamp, createRandom } from './random.js';
import type { CompetitionCategory } from './types.js';

export interface GeneratedBody {
  heightCm: number;
  weightKg: number;
  heightZ: number;
  weightForHeightZ: number;
}

const BODY_MODELS: Record<CompetitionCategory, {
  heightMean: number;
  heightSd: number;
  bmiMean: number;
  bmiSd: number;
}> = {
  men: { heightMean:183.0, heightSd:7.5, bmiMean:24.3, bmiSd:2.0 },
  women: { heightMean:170.5, heightSd:7.0, bmiMean:22.8, bmiSd:1.8 }
};

export function generateBody(
  category: CompetitionCategory,
  seed: string
): GeneratedBody {
  const rng = createRandom(seed);
  const model = BODY_MODELS[category];
  const heightZ = clamp(rng.normal(), -2.8, 3.0);
  const weightForHeightZ = clamp(rng.normal(), -2.6, 3.0);
  const heightCm = model.heightMean + heightZ * model.heightSd;
  const bmi = clamp(model.bmiMean + weightForHeightZ * model.bmiSd, 18.5, 32);
  const heightM = heightCm / 100;
  const weightKg = bmi * heightM * heightM;

  return {
    heightCm: Math.round(heightCm * 10) / 10,
    weightKg: Math.round(weightKg * 10) / 10,
    heightZ,
    weightForHeightZ
  };
}
