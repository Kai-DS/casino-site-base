import type { AvailableActions, CpuStyle, HoldemPhase, HoldemSeat, PreflopStrength } from "../types";
import {
  amountToCallForSeat,
  getEffectiveAllInAmount,
  maxRaiseToForSeat,
  validateAllIn,
} from "./betting";

export type CpuDecision =
  | { action: "check" }
  | { action: "call"; amount: number }
  | { action: "bet"; amount: number }
  | { action: "raise"; raiseTo: number }
  | { action: "allIn"; amount: number }
  | { action: "fold" };

export interface CpuDecisionInput {
  seat: HoldemSeat;
  seats: readonly HoldemSeat[];
  currentBet: number;
  bigBlind: number;
  minRaise: number;
  phase?: HoldemPhase;
  availableActions: AvailableActions;
}

function isAggressive(style: CpuStyle | undefined): boolean {
  return style === "tightAggressive" || style === "looseAggressive";
}

function isLoose(style: CpuStyle | undefined): boolean {
  return style === "loosePassive" || style === "looseAggressive";
}

function chooseBetAmount(input: CpuDecisionInput): CpuDecision {
  const maxAdditional = getEffectiveAllInAmount(input.seat, input.seats);
  const preferred = isAggressive(input.seat.style) ? input.bigBlind * 2 : input.bigBlind;
  const amount = Math.min(preferred, maxAdditional, input.seat.tableStack);
  const allInAmount = input.availableActions.allIn.amount ?? maxAdditional;

  if (amount === allInAmount && input.availableActions.allIn.enabled) {
    return { action: "allIn", amount: allInAmount };
  }
  if (input.availableActions.bet.enabled && amount >= input.bigBlind && amount < input.seat.tableStack) {
    return { action: "bet", amount };
  }
  return { action: "check" };
}

function chooseRaiseTo(input: CpuDecisionInput): CpuDecision {
  const maxRaiseTo = maxRaiseToForSeat(input.seat, input.seats);
  const raiseTo = Math.min(input.currentBet + input.minRaise, maxRaiseTo);
  const amount = raiseTo - input.seat.streetContribution;
  const allInAmount = input.availableActions.allIn.amount ?? getEffectiveAllInAmount(input.seat, input.seats);

  if (amount === allInAmount && input.availableActions.allIn.enabled) {
    return { action: "allIn", amount: allInAmount };
  }
  if (input.availableActions.raise.enabled && raiseTo >= input.currentBet + input.minRaise && amount < input.seat.tableStack) {
    return { action: "raise", raiseTo };
  }
  return input.availableActions.call.enabled
    ? { action: "call", amount: Math.min(amountToCallForSeat(input.seat, input.currentBet), input.seat.tableStack) }
    : { action: "fold" };
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
  const strength = input.phase === "preflop" ? evaluatePreflopStrength(input.seat) : "playable";

  if (amountToCall === 0) {
    if (
      input.currentBet > 0 &&
      (strength === "premium" || (strength === "strong" && isAggressive(input.seat.style)))
    ) {
      return chooseRaiseTo(input);
    }
    if (
      input.currentBet === 0 &&
      input.phase !== "preflop" &&
      input.availableActions.bet.enabled &&
      isAggressive(input.seat.style)
    ) {
      return chooseBetAmount(input);
    }
    return { action: "check" };
  }

  if (input.phase === "preflop" && strength === "weak" && input.currentBet > input.bigBlind) {
    return { action: "fold" };
  }

  if (
    (strength === "premium" || (strength === "strong" && isAggressive(input.seat.style))) &&
    input.availableActions.raise.enabled
  ) {
    return chooseRaiseTo(input);
  }

  if (input.availableActions.call.enabled && (strength !== "weak" || isLoose(input.seat.style))) {
    return { action: "call", amount: Math.min(amountToCall, input.seat.tableStack) };
  }

  const allInAmount = input.availableActions.allIn.amount ?? getEffectiveAllInAmount(input.seat, input.seats);
  const allInResult = validateAllIn(input.seat, input.seats, input.currentBet, input.bigBlind, input.minRaise, allInAmount);
  if (input.availableActions.allIn.enabled && allInResult.ok && strength === "premium") {
    return { action: "allIn", amount: allInAmount };
  }

  return { action: "fold" };
}
