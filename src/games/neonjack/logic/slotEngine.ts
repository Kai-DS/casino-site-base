// games/neonjack/logic/slotEngine.ts — pure spin logic. No React, no store. Vitest-tested.
import type { NeonJackSpinOutput, SpinRole } from "../types";
import { BET_MEDALS, OUTCOME_WEIGHTS, ROLE_REELS, WEIGHT_TOTAL } from "../data/reels";
import { payoutForRole, isBonusRole } from "./payout";
import { defaultRng, type Rng } from "@/utils/random";

/** Draw a role from the weighted outcome table. */
export function drawRole(rng: Rng = defaultRng): SpinRole {
  // Scale into [0, WEIGHT_TOTAL) and walk the cumulative weights.
  let ticket = Math.floor(rng() * WEIGHT_TOTAL);
  for (const { role, weight } of OUTCOME_WEIGHTS) {
    if (ticket < weight) return role;
    ticket -= weight;
  }
  return "blank"; // unreachable; defensive
}

/** Play one spin (bet is always 3 medals — the real-machine model is unchanged). */
export function spin(rng: Rng = defaultRng): NeonJackSpinOutput {
  const role = drawRole(rng);
  return {
    role,
    reels: ROLE_REELS[role],
    betMedals: BET_MEDALS,
    payoutMedals: payoutForRole(role),
    isBonus: isBonusRole(role),
    lampOn: isBonusRole(role),
  };
}
