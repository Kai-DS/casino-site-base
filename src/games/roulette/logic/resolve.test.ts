import { describe, expect, it } from "vitest";
import { CALL_BET_DEFS } from "../constants/callBets";
import type { PlacedBet, PositionId } from "../types";
import { resolveSpin } from "./resolve";

function bet(positionId: PositionId, amount: number, betId = positionId): PlacedBet {
  return { betId, positionId, amount, origin: "table" };
}

function callBetBets(amount: number): PlacedBet[] {
  return CALL_BET_DEFS.orphelins.components.map((component, index) => ({
    betId: `orphelins-${index}`,
    positionId: component.positionId,
    amount: component.chips * amount,
    groupId: "orphelins",
    origin: "racetrack",
  }));
}

describe("roulette resolveSpin", () => {
  it("loses every outside bet on zero through covered-number data", () => {
    const outsideIds = [
      "red",
      "black",
      "odd",
      "even",
      "low",
      "high",
      "dozen-1",
      "dozen-2",
      "dozen-3",
      "column-1",
      "column-2",
      "column-3",
    ];
    const settlement = resolveSpin(outsideIds.map((id) => bet(id, 10)), 0);

    expect(settlement.result).toEqual({
      number: 0,
      color: "green",
      parity: null,
      range: null,
      dozen: null,
      column: null,
    });
    expect(settlement.outcomes.every((outcome) => !outcome.won && outcome.returned === 0)).toBe(true);
    expect(settlement.totalReturned).toBe(0);
    expect(settlement.profit).toBe(-120);
  });

  it("pays both Orphelins splits that cover 17", () => {
    const settlement = resolveSpin(callBetBets(10), 17);

    expect(settlement.outcomes.filter((outcome) => outcome.won).map((outcome) => outcome.positionId)).toEqual([
      "split-14-17",
      "split-17-20",
    ]);
    expect(settlement.totalBet).toBe(50);
    expect(settlement.totalReturned).toBe(360);
    expect(settlement.profit).toBe(310);
  });

  it("matches the fixed 17 example from the animation contract", () => {
    const settlement = resolveSpin([
      bet("straight-17", 10, "straight-17-main"),
      bet("dozen-2", 20, "dozen-2-main"),
      ...callBetBets(10),
    ], 17);

    expect(settlement.totalBet).toBe(80);
    expect(settlement.totalReturned).toBe(780);
    expect(settlement.profit).toBe(700);
    expect(settlement.winningBetIds).toHaveLength(4);
    expect(settlement.losingBetIds).toHaveLength(3);
  });
});
