import type { Rate } from "@/types/casino";
import type { GameResultDraft } from "@/games/shared/economy";
import type { SpinSettlement } from "./types";

export interface RouletteConfig {
  chipDenoms: readonly number[];
  minTotalBet: number;
  maxBetPerPosition: number;
  maxTotalBet: number;
  neighborRange: { min: number; max: number; default: number };
}

export function toRouletteRateConfig(rate: Rate): RouletteConfig {
  return {
    chipDenoms: [1, 2, 5].map((m) => m * rate.betMin),
    minTotalBet: rate.betMin,
    maxBetPerPosition: rate.betMax,
    maxTotalBet: rate.betMax * 10,
    neighborRange: { min: 1, max: 4, default: 2 },
  };
}

export function buildRouletteGameResult(s: SpinSettlement): GameResultDraft {
  return {
    gameId: "roulette",
    bet: s.totalBet,
    payout: s.totalReturned,
    profit: s.profit,
  };
}
