// games/videoPoker/adapter.ts — seam between Video Poker and the casino economy.
// Per SPEC_VIDEO_POKER_v1.2 §8–§9. bet = betMin × coinCount; payout from evaluatePayout.
import type { Rate } from "@/types/casino";
import type { GameResultDraft } from "@/games/shared/economy";
import type { CoinCount, PayoutResult } from "./logic/payout";

/** Classic VP: Royal jumps to 4000 coins at MAX BET. Flag per spec §9. */
export const CLASSIC_ROYAL_BONUS = true;

export function videoPokerBet(rate: Rate, coinCount: CoinCount): number {
  return rate.betMin * coinCount;
}

/** Build the casino-ledger draft from a resolved payout. */
export function buildVideoPokerResult(bet: number, result: PayoutResult): GameResultDraft {
  return {
    gameId: "videoPoker",
    bet,
    payout: result.payout,
    profit: result.profit,
  };
}
