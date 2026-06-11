import { describe, expect, it } from "vitest";
import type { BetType } from "../types";
import { EXPECTED_POSITION_COUNTS, POSITION_LIST, validatePositionTable } from "./positions";

describe("roulette positions", () => {
  it("has the expected total, type counts, and unique ids", () => {
    validatePositionTable();
    expect(POSITION_LIST).toHaveLength(157);

    const ids = new Set(POSITION_LIST.map((position) => position.id));
    expect(ids.size).toBe(POSITION_LIST.length);

    const counts = POSITION_LIST.reduce<Record<BetType, number>>((acc, position) => {
      acc[position.type] += 1;
      return acc;
    }, {
      straight: 0,
      split: 0,
      street: 0,
      corner: 0,
      sixLine: 0,
      trio: 0,
      firstFour: 0,
      red: 0,
      black: 0,
      odd: 0,
      even: 0,
      low: 0,
      high: 0,
      dozen: 0,
      column: 0,
    });

    expect(counts).toEqual(EXPECTED_POSITION_COUNTS);
    expect(POSITION_LIST.filter((position) => position.category === "outside")).toHaveLength(12);
  });

  it("keeps covered numbers sorted, in range, and payout-balanced", () => {
    for (const position of POSITION_LIST) {
      expect(position.coveredNumbers).toEqual([...position.coveredNumbers].sort((a, b) => a - b));
      expect(new Set(position.coveredNumbers).size).toBe(position.coveredNumbers.length);
      for (const n of position.coveredNumbers) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(36);
      }
      expect(position.coveredNumbers.length * (position.payout + 1)).toBe(36);
    }
  });
});
