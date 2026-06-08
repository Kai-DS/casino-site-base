import type { GameResultDraft } from "@/games/shared/economy";
import type { HoldemRateConfig, HoldemResult, Rate } from "./types";

export function toHoldemRateConfig(rate: Rate): HoldemRateConfig {
  return {
    rate,
    smallBlind: rate.betMin,
    bigBlind: rate.betMin * 2,
    minRaise: rate.betMin * 2,
  };
}

export function buildHoldemGameResult(result: HoldemResult): GameResultDraft {
  const playerContribution = Math.max(0, result.playerWonAmount - result.playerProfit);
  return {
    gameId: "holdem",
    bet: playerContribution,
    payout: result.playerWonAmount,
    profit: result.playerProfit,
  };
}
