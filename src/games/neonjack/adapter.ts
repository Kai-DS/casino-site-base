// games/neonjack/adapter.ts — the ONLY seam between NEON JACK and the casino economy.
// Internal logic is never touched; betMin is read as "chips per medal". BET stays fixed at
// 3 medals (MAX BET does not apply to a Juggler-style machine). Spec §5.5.
import type { Rate } from "@/types/casino";
import type { NeonJackSpinOutput } from "./types";
import type { GameResultDraft } from "@/games/shared/economy";

/** chips per medal at this rate (NEON JACK ignores buyInMax/betMax). */
function chipsPerMedal(rate: Rate): number {
  return rate.betMin;
}

/** Convert one spin's medal in/out into chip bet/payout for the casino ledger. */
export function buildNeonJackResult(spin: NeonJackSpinOutput, rate: Rate): GameResultDraft {
  const unit = chipsPerMedal(rate);
  const bet = spin.betMedals * unit;
  const payout = spin.payoutMedals * unit;
  return {
    gameId: "neonjack",
    bet,
    payout,
    profit: payout - bet,
  };
}

/** Chip cost of a single spin at this rate — used to gate the SPIN button. */
export function neonJackSpinCost(rate: Rate): number {
  return 3 * chipsPerMedal(rate);
}
