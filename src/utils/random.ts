// utils/random.ts — centralised RNG so game logic stays pure & testable
// (inject a custom Rng in tests for deterministic results).

export type Rng = () => number; // returns [0, 1)

export const defaultRng: Rng = Math.random;

/** Integer in [0, maxExclusive). */
export function randomInt(maxExclusive: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * maxExclusive);
}

/** Pick one element (throws on empty array). */
export function pick<T>(arr: readonly T[], rng: Rng = defaultRng): T {
  if (arr.length === 0) throw new Error("pick() on empty array");
  return arr[randomInt(arr.length, rng)]!;
}

/** True with the given probability p in [0, 1]. */
export function chance(p: number, rng: Rng = defaultRng): boolean {
  return rng() < p;
}

/** Fisher–Yates shuffle returning a NEW array (input not mutated). */
export function shuffle<T>(arr: readonly T[], rng: Rng = defaultRng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
