// games/texasHoldem/components/ResultBanner.tsx
// WINNER / LOSE banner. The win-FX intensity follows the hand-category hierarchy (§24.8):
// flashy stuff is reserved for Straight/Royal Flush; a loss is shown gracefully — dim + fade,
// never a shake (§24.9). Winner, amounts and category are read from the logic's result.
import { formatChips, formatSignedChips } from "@/utils/format";
import type { HoldemResult, HoldemSeat } from "../types";
import type { ResultBannerView } from "./useHoldemAnimationQueue";
import { resultCategoryLabel, winTier, type WinTier } from "./holdemLabels";

type ResultBannerProps = {
  banner: ResultBannerView | null;
  result: HoldemResult | null;
  seats: HoldemSeat[];
  playerSeatIndex: number | null;
  reducedMotion?: boolean;
  onNextHand?: () => void;
  canNextHand?: boolean;
};

const TIER_FRAME: Record<WinTier, string> = {
  subtle: "border-[var(--gold)]/40 shadow-[0_0_20px_rgba(233,196,106,0.25)]",
  standard: "border-[var(--gold)]/60 shadow-[0_0_30px_rgba(233,196,106,0.35)]",
  strong: "border-[var(--neon)]/70 shadow-[0_0_40px_rgba(43,217,196,0.45)]",
  big: "border-[var(--gold-2)] shadow-[0_0_60px_rgba(244,214,128,0.6)]",
  premier: "border-[var(--gold-2)] shadow-[0_0_90px_rgba(244,214,128,0.85)]",
};

export function ResultBanner({
  banner,
  result,
  seats,
  playerSeatIndex,
  reducedMotion = false,
  onNextHand,
  canNextHand = false,
}: ResultBannerProps) {
  if (!banner || !result) return null;

  const playerWon = banner.winners.includes(playerSeatIndex ?? -1);
  const isSplit = banner.winners.length > 1;
  const tier = winTier(banner.category);
  const winnerNames = banner.winners
    .map((idx) => seats.find((s) => s.seatIndex === idx)?.name ?? `Seat ${idx}`)
    .join(" / ");

  const title = playerWon ? (isSplit ? "SPLIT POT" : "YOU WIN") : "YOU LOSE";

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      {/* premier (SF/RF): a one-shot full-stage gold shimmer */}
      {playerWon && tier === "premier" && !reducedMotion && (
        <div className="holdem-win-shimmer absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_45%,rgba(244,214,128,0.25),transparent_60%)]" />
      )}

      <div
        className={`pointer-events-auto flex min-w-[16rem] flex-col items-center gap-1 rounded-2xl border bg-black/80 px-6 py-4 text-center backdrop-blur-sm ${
          playerWon ? TIER_FRAME[tier] : "border-white/15 opacity-95"
        } ${reducedMotion ? "" : "holdem-banner-in"}`}
      >
        <span
          className={`font-display text-2xl font-bold tracking-wide ${
            playerWon ? "text-[var(--gold-2)]" : "text-[var(--text-mid)]"
          } ${playerWon && tier === "premier" && !reducedMotion ? "holdem-win-shimmer" : ""}`}
        >
          {title}
        </span>

        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-hi)]">
          {resultCategoryLabel(banner.category)}
        </span>

        {!playerWon && <span className="text-xs text-[var(--text-mid)]">Winner: {winnerNames}</span>}

        <div className="mt-1 flex items-center gap-4 text-sm tabular-nums">
          {playerWon && result.playerWonAmount > 0 && (
            <span className="text-[var(--text-mid)]">
              WON <span className="font-semibold text-emerald-300">{formatChips(result.playerWonAmount)}</span>
            </span>
          )}
          <span className="text-[var(--text-mid)]">
            NET{" "}
            <span
              className={`font-semibold ${
                result.playerProfit > 0
                  ? "text-emerald-300"
                  : result.playerProfit < 0
                    ? "text-red-300"
                    : "text-white/70"
              }`}
            >
              {formatSignedChips(result.playerProfit)}
            </span>
          </span>
        </div>

        {onNextHand && (
          <button
            type="button"
            disabled={!canNextHand}
            onClick={onNextHand}
            className="focus-ring mt-2 rounded-lg border border-[var(--rail)]/60 bg-[var(--rail)]/15 px-4 py-1.5 text-sm font-semibold text-[var(--gold-2)] hover:bg-[var(--rail)]/25 disabled:opacity-40"
          >
            Next hand
          </button>
        )}
      </div>
    </div>
  );
}
