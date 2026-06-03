// games/neonjack/adapter.ts — the ONLY seam between NEON JACK and the casino economy.
// Internal logic is never touched; the rate's betUnit is read as "chips per medal". Spec §5.5.
import type { Rate } from "@/types/casino";
import type { GameResult } from "@/types/game";
import type { NeonJackSpinOutput } from "./types";

/** What casinoStore.applyGameResult expects (it owns id/userId/playedAt). */
export type GameResultDraft = Omit<GameResult, "id" | "userId" | "playedAt">;

/** Convert one spin's medal in/out into chip bet/payout for the casino ledger. */
export function buildNeonJackResult(spin: NeonJackSpinOutput, rate: Rate): GameResultDraft {
  const chipsPerMedal = rate.betUnit;
  const bet = spin.betMedals * chipsPerMedal;
  const payout = spin.payoutMedals * chipsPerMedal;
  return {
    gameId: "neonjack",
    bet,
    payout,
    profit: payout - bet,
  };
}

/** Chip cost of a single spin at this rate — used to gate the SPIN button. */
export function neonJackSpinCost(rate: Rate): number {
  return 3 * rate.betUnit;
}
