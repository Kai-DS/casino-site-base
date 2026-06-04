// games/videoPoker/adapter.ts — seam between Video Poker and the casino economy.
// A bet is 1..5 coins (each coin = rate.betMin). Payout = multiplier × bet, with the classic
// Jacks-or-Better twist: a Royal Flush jumps at MAX BET (spec §8 revised, §9.2).
import type { Rate } from "@/types/casino";
import type { HandRank } from "@/games/shared/poker/handEvaluator";
import { classifyVideoPoker, type PayoutLine } from "./logic/payout";
import { coinsForBet, MAX_COINS } from "@/constants/rates";
import type { GameResultDraft } from "@/games/shared/economy";

/** Classic VP: Royal at MAX BET pays 4000 coins (800/coin) instead of 250/coin. */
export const CLASSIC_ROYAL_BONUS = true;
export const ROYAL_MAX_BET_COINS = 4000;

/** Default (1-coin) bet for a rate. */
export function videoPokerBet(rate: Rate): number {
  return rate.betMin;
}

/** Chips paid out for a ranked hand at the given chosen bet. */
export function videoPokerPayout(hand: HandRank, rate: Rate, bet: number): number {
  const line = classifyVideoPoker(hand);
  const coins = coinsForBet(rate, bet);
  if (CLASSIC_ROYAL_BONUS && line.label === "Royal Flush" && coins >= MAX_COINS) {
    return ROYAL_MAX_BET_COINS * rate.betMin; // = 800 × bet at max bet
  }
  return line.multiplier * bet;
}

export function buildVideoPokerResult(hand: HandRank, rate: Rate, bet: number): GameResultDraft {
  const payout = videoPokerPayout(hand, rate, bet);
  return {
    gameId: "videoPoker",
    bet,
    payout,
    profit: payout - bet,
  };
}

export { classifyVideoPoker };
export type { PayoutLine };
