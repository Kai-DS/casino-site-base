import { describe, expect, it } from "vitest";
import { CALL_BET_DEFS } from "../constants/callBets";
import type { PlacedBet } from "../types";
import { validatePlaceChip, validatePlacementAmounts } from "./bets";

function placed(positionId: string, amount: number): PlacedBet {
  return { betId: `${positionId}-${amount}`, positionId, amount, origin: "table" };
}

describe("roulette bet validation", () => {
  it("keeps the specified placeChip validation order", () => {
    const base = {
      phase: "betting" as const,
      isAnimating: false,
      bets: [] as PlacedBet[],
      stagedTotal: 0,
      chips: 1_000,
      maxBetPerPosition: 100,
      maxTotalBet: 500,
    };

    expect(validatePlaceChip({ ...base, phase: "result", isAnimating: true }, "straight-17", 10))
      .toMatchObject({ ok: false, reason: "INVALID_PHASE" });
    expect(validatePlaceChip({ ...base, chips: 0, maxBetPerPosition: 0, maxTotalBet: 0 }, "straight-17", 10))
      .toMatchObject({ ok: false, reason: "INSUFFICIENT_FUNDS" });
    expect(validatePlaceChip({ ...base, chips: 0 }, "not-a-position", 10))
      .toMatchObject({ ok: false, reason: "INVALID_POSITION" });
    expect(validatePlaceChip({
      ...base,
      bets: [placed("straight-17", 10)],
      stagedTotal: 10,
      maxBetPerPosition: 10,
      maxTotalBet: 15,
    }, "straight-17", 10)).toMatchObject({ ok: false, reason: "POSITION_LIMIT" });
    expect(validatePlaceChip({
      ...base,
      bets: [placed("straight-17", 10)],
      stagedTotal: 10,
      maxBetPerPosition: 100,
      maxTotalBet: 15,
    }, "straight-18", 10)).toMatchObject({ ok: false, reason: "TABLE_LIMIT" });
  });

  it("pre-validates call bet components atomically", () => {
    const originalBets = [placed("straight-1", 10)];
    const result = validatePlacementAmounts(
      {
        phase: "betting",
        isAnimating: false,
        bets: originalBets,
        stagedTotal: 10,
        chips: 1_000,
        maxBetPerPosition: 10,
        maxTotalBet: 500,
      },
      CALL_BET_DEFS.orphelins.components.map((component) => ({
        positionId: component.positionId,
        amount: component.chips * 10,
      })),
    );

    expect(result).toMatchObject({ ok: false, reason: "POSITION_LIMIT" });
    expect(originalBets).toEqual([placed("straight-1", 10)]);
  });
});
