import { PAYOUT_LABELS, type PayoutResult } from "../logic/payout";
import { formatChips, formatSignedChips } from "@/utils/format";

type VideoPokerResultBannerProps = {
  result: PayoutResult | null;
  phase: "unseated" | "buyIn" | "ready" | "draw" | "result";
};

const BIG_HANDS = new Set(["four_of_a_kind", "straight_flush", "royal_flush"]);

/** Result strip: hand name + BET / WIN / PROFIT (spec §29.1). WIN = payout, PROFIT = payout − bet. */
export function VideoPokerResultBanner({ result, phase }: VideoPokerResultBannerProps) {
  if (!result) {
    return (
      <div className="flex h-14 items-center justify-center text-sm text-white/30">
        {phase === "draw" ? "Tap cards to HOLD, then DRAW" : "Choose your bet, then DEAL"}
      </div>
    );
  }

  const won = result.payout > 0;
  const big = won && BIG_HANDS.has(result.category);
  const bet = result.payout - result.profit;

  return (
    <div
      className={`animate-fadeIn flex h-14 items-center justify-between rounded-xl border px-4 ${
        big
          ? "border-gold-400 bg-gold-500/15 shadow-gold"
          : won
            ? "border-gold-500/40 bg-black/40"
            : "border-white/10 bg-black/30"
      }`}
    >
      <span
        className={`font-display ${big ? "animate-glowPulse text-2xl" : "text-lg"} ${
          won ? "text-gold" : "text-white/40"
        }`}
      >
        {PAYOUT_LABELS[result.category]}
        {result.isRoyalMaxBonus && " ★"}
      </span>

      <div className="flex items-center gap-3 text-right text-xs tabular-nums sm:gap-4 sm:text-sm">
        <span className="text-white/50">
          BET <span className="font-semibold text-white/80">{formatChips(bet)}</span>
        </span>
        <span className="text-white/50">
          WIN <span className={`font-semibold ${won ? "text-green-400" : "text-white/60"}`}>{formatChips(result.payout)}</span>
        </span>
        <span className="text-white/50">
          PROFIT{" "}
          <span
            className={`font-semibold ${
              result.profit > 0 ? "text-green-400" : result.profit < 0 ? "text-red-300" : "text-white/60"
            }`}
          >
            {formatSignedChips(result.profit)}
          </span>
        </span>
      </div>
    </div>
  );
}
