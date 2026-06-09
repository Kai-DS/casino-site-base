import type { HoldemPhase, HoldemSeat, PreflopStrength } from "../types";
import { amountToCallForSeat, getHandContributionCap } from "./betting";

export type CpuDecision =
  | { action: "check" }
  | { action: "call"; amount: number }
  | { action: "fold" };

export interface CpuDecisionInput {
  seat: HoldemSeat;
  seats: readonly HoldemSeat[];
  currentBet: number;
  phase?: HoldemPhase;
}

export function evaluatePreflopStrength(seat: HoldemSeat): PreflopStrength {
  const [a, b] = seat.holeCards;
  if (!a || !b) return "weak";

  const ranks = [a.rank, b.rank].sort((x, y) => y - x);
  const suited = a.suit === b.suit;
  const pair = ranks[0] === ranks[1];
  const high = ranks[0]!;
  const low = ranks[1]!;

  if ((pair && high >= 12) || (high === 14 && low === 13 && suited)) return "premium";
  if ((pair && high >= 10) || (high === 14 && low >= 12) || (high === 13 && low === 12 && suited)) {
    return "strong";
  }
  if (pair || suited || high >= 14 || high - low === 1) return "playable";
  return "weak";
}

export function chooseCpuAction(input: CpuDecisionInput): CpuDecision {
  const amountToCall = amountToCallForSeat(input.seat, input.currentBet);
  if (amountToCall === 0) return { action: "check" };

  if (input.phase === "preflop" && evaluatePreflopStrength(input.seat) === "weak") {
    return { action: "fold" };
  }

  const cap = getHandContributionCap(input.seats);
  if (input.seat.tableStack >= amountToCall && input.seat.totalContribution + amountToCall <= cap) {
    return { action: "call", amount: amountToCall };
  }

  return { action: "fold" };
}
