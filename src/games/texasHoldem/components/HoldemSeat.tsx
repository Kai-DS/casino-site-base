// games/texasHoldem/components/HoldemSeat.tsx
// One player's nameplate + hole cards, placed OUTSIDE the felt (spec §24.1 redesign). Shows
// name, stack (as chips), status, dealer/blind badges, the turn indicator (breathing glow +
// CPU progress ring, §24.5) and the action label (§24.11). The street bet chips live on the
// felt (a separate layer), not here. All values are read from the seat; nothing is recomputed.
import type { Card, HoldemSeat as HoldemSeatModel } from "../types";
import type { ActionLabel } from "./useHoldemAnimationQueue";
import { actionLabel } from "./holdemLabels";
import { ChipStack } from "@/components/casino/ChipStack";
import { HoleCards } from "./HoleCards";

type HoldemSeatProps = {
  seat: HoldemSeatModel;
  isTurn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isWinner: boolean;
  shownHoleCount: number;
  faceUp: boolean;
  dealingIndexes?: ReadonlySet<number>;
  label?: ActionLabel;
  thinking?: boolean;
  highlight?: Card[];
  hero?: boolean;
  /** Render hole cards below the plaque (top seats) instead of above. */
  cardsBelow?: boolean;
  reducedMotion?: boolean;
};

const STATUS_LABEL: Partial<Record<HoldemSeatModel["status"], string>> = {
  folded: "FOLDED",
  allIn: "ALL-IN",
  busted: "BUSTED",
  sittingOut: "SITTING OUT",
};

function Badge({ children, tone }: { children: string; tone: string }) {
  return <span className={`rounded px-1 text-[9px] font-bold leading-4 ${tone}`}>{children}</span>;
}

export function HoldemSeat({
  seat,
  isTurn,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isWinner,
  shownHoleCount,
  faceUp,
  dealingIndexes,
  label,
  thinking,
  highlight,
  hero = false,
  cardsBelow = false,
  reducedMotion = false,
}: HoldemSeatProps) {
  const dimmed = seat.status === "folded" || seat.status === "busted" || seat.status === "sittingOut";
  const statusLabel = STATUS_LABEL[seat.status];
  const initial = seat.isHuman ? "YOU" : `C${seat.seatIndex}`;

  const cards = (
    <HoleCards
      cards={seat.holeCards}
      shownCount={shownHoleCount}
      faceUp={faceUp}
      dealingIndexes={dealingIndexes}
      hero={hero}
      reducedMotion={reducedMotion}
      highlight={highlight}
    />
  );

  return (
    <div className={`relative flex flex-col items-center gap-1.5 ${dimmed ? "opacity-50 grayscale" : ""}`}>
      {/* Action label (§24.11) */}
      {label && (
        <div className="holdem-label-pop absolute -top-7 z-20 whitespace-nowrap rounded-full border border-[var(--rail)]/60 bg-black/85 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--gold-2)] shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
          {actionLabel(label.action, label.amount)}
        </div>
      )}

      {!cardsBelow && cards}

      {/* Nameplate */}
      <div
        className={`relative flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 backdrop-blur-sm transition-colors ${
          isWinner
            ? "border-[var(--gold-2)] bg-[var(--gold)]/20 shadow-[0_0_22px_rgba(244,214,128,0.55)]"
            : isTurn
              ? "border-[var(--gold-2)]/80 bg-black/65"
              : "border-white/12 bg-black/55"
        } ${isTurn && !reducedMotion ? "holdem-turn-glow" : ""}`}
      >
        {/* CPU thinking progress ring (§24.5) */}
        {thinking && !reducedMotion && (
          <span className="pointer-events-none absolute -inset-1 rounded-3xl">
            <span className="holdem-spin absolute inset-0 rounded-3xl border-2 border-transparent border-t-[var(--neon)]" />
          </span>
        )}

        {/* avatar token */}
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
            seat.isHuman ? "bg-[var(--gold)] text-black" : "bg-white/12 text-white/80"
          } ring-1 ring-black/30`}
        >
          {initial}
        </span>

        <div className="flex min-w-0 flex-col leading-tight">
          <div className="flex items-center gap-1">
            <span className="max-w-[6rem] truncate text-xs font-semibold text-[var(--text-hi)]">{seat.name}</span>
            {isDealer && <Badge tone="bg-white text-black">D</Badge>}
            {isSmallBlind && <Badge tone="bg-sky-500 text-white">SB</Badge>}
            {isBigBlind && <Badge tone="bg-amber-500 text-black">BB</Badge>}
          </div>
          <ChipStack amount={seat.tableStack} size="sm" />
        </div>

        {statusLabel && (
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-2 text-[9px] font-bold uppercase tracking-wide text-[var(--text-mid)]">
            {statusLabel}
          </span>
        )}
      </div>

      {cardsBelow && cards}
    </div>
  );
}
