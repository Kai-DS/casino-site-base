// games/neonjack/logic/payout.ts — pure payout table (medals). UI-independent, Vitest-tested.
import type { SpinRole } from "../types";
import { BET_MEDALS, OUTCOME_WEIGHTS, WEIGHT_TOTAL } from "../data/reels";

/** Medals paid out for each role. REPLAY refunds the bet (net 0). */
export const PAYOUT_MEDALS: Record<SpinRole, number> = {
  big: 240,
  reg: 96,
  grape: 8,
  cherry: 2,
  replay: BET_MEDALS, // refund → net 0
  blank: 0,
};

export function payoutForRole(role: SpinRole): number {
  return PAYOUT_MEDALS[role];
}

export function isBonusRole(role: SpinRole): boolean {
  return role === "big" || role === "reg";
}

/** Theoretical return-to-player (payout / bet) from the weight + payout tables. For tests/tuning. */
export function theoreticalRtp(): number {
  const expectedPayout =
    OUTCOME_WEIGHTS.reduce((sum, o) => sum + o.weight * PAYOUT_MEDALS[o.role], 0) / WEIGHT_TOTAL;
  return expectedPayout / BET_MEDALS;
}
