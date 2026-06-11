import { describe, expect, it } from "vitest";
import { POSITION_TABLE } from "./positions";
import { CALL_BET_DEFS, makeNeighborsBet } from "./callBets";
import { WHEEL_ORDER } from "./wheel";

function sorted(numbers: readonly number[]): number[] {
  return [...numbers].sort((a, b) => a - b);
}

function coveredByComponents(components: ReadonlyArray<{ positionId: string }>): number[] {
  return sorted([...new Set(components.flatMap((component) => POSITION_TABLE[component.positionId]!.coveredNumbers))]);
}

function wheelArc(start: number, end: number): number[] {
  const startIndex = WHEEL_ORDER.indexOf(start as (typeof WHEEL_ORDER)[number]);
  if (startIndex < 0) throw new Error(`Missing wheel start: ${start}`);
  const numbers: number[] = [];
  for (let step = 0; step < WHEEL_ORDER.length; step += 1) {
    const number = WHEEL_ORDER[(startIndex + step) % WHEEL_ORDER.length]!;
    numbers.push(number);
    if (number === end) return sorted(numbers);
  }
  throw new Error(`Missing wheel end: ${end}`);
}

describe("roulette call bets", () => {
  it("expands call bets to their expected cover sets and chip counts", () => {
    expect(CALL_BET_DEFS.voisins.chipCount).toBe(9);
    expect(coveredByComponents(CALL_BET_DEFS.voisins.components)).toEqual(wheelArc(22, 25));

    expect(CALL_BET_DEFS.tiers.chipCount).toBe(6);
    expect(coveredByComponents(CALL_BET_DEFS.tiers.components)).toEqual(wheelArc(27, 33));

    expect(CALL_BET_DEFS.orphelins.chipCount).toBe(5);
    expect(coveredByComponents(CALL_BET_DEFS.orphelins.components)).toEqual([1, 6, 9, 14, 17, 20, 31, 34]);

    expect(CALL_BET_DEFS.jeuZero.chipCount).toBe(4);
    expect(coveredByComponents(CALL_BET_DEFS.jeuZero.components)).toEqual(wheelArc(12, 15));
  });

  it("makes neighbor bets with wrap-around at zero", () => {
    const neighbors = makeNeighborsBet(0, 2);
    expect(neighbors.map((component) => component.positionId)).toEqual([
      "straight-3",
      "straight-26",
      "straight-0",
      "straight-32",
      "straight-15",
    ]);
    expect(neighbors.every((component) => component.chips === 1)).toBe(true);
  });

  it("supports neighbor ranges one through four", () => {
    for (const n of [1, 2, 3, 4]) {
      const neighbors = makeNeighborsBet(17, n);
      expect(neighbors).toHaveLength(2 * n + 1);
      expect(neighbors.reduce((sum, component) => sum + component.chips, 0)).toBe(2 * n + 1);
    }
  });
});
