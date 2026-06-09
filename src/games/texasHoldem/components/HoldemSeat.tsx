// games/texasHoldem/components/HoldemSeat.tsx
// One seat around the felt: name + stack, dealer/blind badges, status, the turn indicator
// (breathing glow + CPU progress ring, §24.5), the action label (§24.11), and its hole cards.
// All values are read from the seat the logic gave us; nothing is recomputed here.
import type { Card, HoldemSeat as HoldemSeatModel } from "../types";
import type { ActionLabel, ChipFly } from "./useHoldemAnimationQueue";
import { actionLabel } from "./holdemLabels";
import { seatSlot } from "./tableLayout";
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
  chipFly?: ChipFly | null;
  reducedMotion?: boolean;
};

const STATUS_LABEL: Partial<Record<HoldemSeatModel["status"], string>> = {
  folded: "FOLDED",
  allIn: "ALL-IN",
  busted: "BUSTED",
  sittingOut: "SITTING OUT",
};

function Badge({ children, tone }: { children: string; tone: string }) {
  return (
    <span className={`rounded px-1 text-[9px] font-bold leading-4 ${tone}`}>{children}</span>
  );
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
  chipFly,
  reducedMotion = false,
}: HoldemSeatProps) {
  const slot = seatSlot(seat.seatIndex);
  const dimmed = seat.status === "folded" || seat.status === "busted" || seat.status === "sittingOut";
  const statusLabel = STATUS_LABEL[seat.status];
  const flyVector = chipFly
    ? { ["--fly-x" as string]: `${slot.fly.x}px`, ["--fly-y" as string]: `${slot.fly.y}px` }
    : undefined;

  return (
    <div className={`relative flex flex-col items-center gap-1 ${dimmed ? "opacity-55 grayscale" : ""}`}>
      {/* Action label (§24.11) */}
      {label && (
        <div className="holdem-label-pop absolute -top-6 z-20 rounded-full border border-[var(--rail)]/50 bg-black/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--gold-2)]">
          {actionLabel(label.action, label.amount)}
        </div>
      )}

      {/* Hole cards sit above the nameplate (hero gets larger cards). */}
      <HoleCards
        cards={seat.holeCards}
        shownCount={shownHoleCount}
        faceUp={faceUp}
        dealingIndexes={dealingIndexes}
        hero={slot.hero}
        reducedMotion={reducedMotion}
        highlight={highlight}
      />

      {/* Nameplate */}
      <div
        className={`relative flex min-w-[5.5rem] flex-col items-center rounded-xl border px-2.5 py-1.5 backdrop-blur-sm transition-colors ${
          isWinner
            ? "border-[var(--gold-2)] bg-[var(--gold)]/15"
            : isTurn
              ? "border-[var(--gold-2)]/70 bg-black/55"
              : "border-white/12 bg-black/45"
        } ${isTurn && !reducedMotion ? "holdem-turn-glow" : ""}`}
      >
        {/* CPU thinking progress ring (§24.5) */}
        {thinking && !reducedMotion && (
          <span className="pointer-events-none absolute -inset-1 rounded-2xl ring-2 ring-[var(--neon)]/40">
            <span className="holdem-spin absolute inset-0 rounded-2xl border-2 border-transparent border-t-[var(--neon)]" />
          </span>
        )}

        <div className="flex items-center gap-1">
          <span className="max-w-[5rem] truncate text-xs font-semibold text-[var(--text-hi)]">{seat.name}</span>
          {isDealer && <Badge tone="bg-white text-black">D</Badge>}
          {isSmallBlind && <Badge tone="bg-sky-500 text-white">SB</Badge>}
          {isBigBlind && <Badge tone="bg-amber-500 text-black">BB</Badge>}
        </div>

        <ChipStack amount={seat.tableStack} size="sm" />

        {statusLabel && (
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-dim)]">{statusLabel}</span>
        )}

        {/* This seat's street contribution sitting in front of it */}
        {seat.streetContribution > 0 && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            <ChipStack amount={seat.streetContribution} size="sm" showAmount={false} />
          </div>
        )}
      </div>

      {/* Flying chips to/from the pot (§24.4) */}
      {chipFly && !reducedMotion && (
        <div
          key={chipFly.key}
          className={`pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 ${
            chipFly.kind === "toPot" ? "holdem-chip-fly" : "holdem-chip-award"
          }`}
          style={flyVector}
        >
          <ChipStack amount={chipFly.amount} size="sm" showAmount={false} />
        </div>
      )}
    </div>
  );
}
