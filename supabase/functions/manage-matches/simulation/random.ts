export interface RandomSource {
  next(): number;
  normal(mean?: number, sd?: number): number;
}

function xmur3(value: string): () => number {
  let h = 1779033703 ^ value.length;
  for (let i = 0; i < value.length; i += 1) {
    h = Math.imul(h ^ value.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRandom(seed: string): RandomSource {
  const seedFactory = xmur3(seed);
  const next = mulberry32(seedFactory());
  let spare: number | null = null;

  return {
    next,
    normal(mean = 0, sd = 1) {
      if (spare !== null) {
        const value = spare;
        spare = null;
        return mean + value * sd;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      const mag = Math.sqrt(-2 * Math.log(u));
      const z0 = mag * Math.cos(2 * Math.PI * v);
      spare = mag * Math.sin(2 * Math.PI * v);
      return mean + z0 * sd;
    }
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function weightedChoice<T>(rng: RandomSource, entries: readonly { value: T; weight: number }[]): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.next() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

export function truncatedNormal(
  rng: RandomSource,
  mean: number,
  sd: number,
  min: number,
  max: number
): number {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const value = rng.normal(mean, sd);
    if (value >= min && value <= max) return value;
  }
  return clamp(rng.normal(mean, sd), min, max);
}
