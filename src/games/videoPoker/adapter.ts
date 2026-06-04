// games/videoPoker/adapter.ts — seam between Video Poker and the casino economy.
// betUnit is the base bet; payouts are multiplier × betUnit (spec §8, §9.2).
import type { Rate } from "@/types/casino";
import type { HandRank } from "@/games/shared/poker/handEvaluator";
import { classifyVideoPoker, type PayoutLine } from "./logic/payout";
import type { GameResultDraft } from "@/games/shared/economy";

/** Base bet for one hand at this rate. */
export function videoPokerBet(rate: Rate): number {
  return rate.betUnit;
}

export function buildVideoPokerResult(hand: HandRank, rate: Rate): GameResultDraft {
  const bet = videoPokerBet(rate);
  const payout = classifyVideoPoker(hand).multiplier * rate.betUnit;
  return {
    gameId: "videoPoker",
    bet,
    payout,
    profit: payout - bet,
  };
}

export { classifyVideoPoker };
export type { PayoutLine };
