// games/texasHoldem/components/CommunityCards.tsx
// The board — the centrepiece. Flop / Turn / River reveal (spec §24.3, redesign).
//
// IMPORTANT: the logic puts the flop/turn/river into game.communityCards as soon as it queues the
// REVEAL_* event, and other events (action labels, chip-to-pot) usually play *first*. So we must
// NOT key the board off communityCards.length, or the flop flashes face-up before its reveal.
// Instead we gate by `revealedCount` (cards whose REVEAL has completed, from the queue):
//   • i < revealedCount                        → settled, face-up, static
//   • during the active REVEAL, the next chunk → dealt in face-DOWN then flipped left→right
//   • everything else                          → empty slot (hidden until its reveal plays)
import type { CSSProperties } from "react";
import type { AnimationEvent, Card } from "../types";
import { COMMUNITY } from "./motion";
import { FlipCard } from "./HoldemCard";

type CommunityCardsProps = {
  cards: Card[];
  activeEvent: AnimationEvent | null;
  /** Community cards whose REVEAL event has completed (from the animation queue). */
  revealedCount: number;
  /** When false (no event queue), show the whole board immediately (no staging). */
  animated?: boolean;
  reducedMotion?: boolean;
  highlight?: Card[];
};

function revealingCount(activeEvent: AnimationEvent | null): number {
  switch (activeEvent?.type) {
    case "REVEAL_FLOP":
      return 3;
    case "REVEAL_TURN":
    case "REVEAL_RIVER":
      return 1;
    default:
      return 0;
  }
}

export function CommunityCards({
  cards,
  activeEvent,
  revealedCount,
  animated = true,
  reducedMotion = false,
  highlight,
}: CommunityCardsProps) {
  // settled = how many cards are already face-up & static. When not animating, that's all of them.
  const settled = animated ? Math.min(revealedCount, cards.length) : cards.length;
  const revealing = animated ? revealingCount(activeEvent) : 0;
  const isRiver = activeEvent?.type === "REVEAL_RIVER";
  const highlightIds = new Set((highlight ?? []).map((c) => c.id));

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const card = cards[i];
        const isSettled = i < settled;
        const isRevealing = !isSettled && i < settled + revealing;
        if (!card || (!isSettled && !isRevealing)) {
          // Empty slot (also hides cards already in state but not yet revealed).
          return (
            <div
              key={`slot-${i}`}
              className="aspect-[2.5/3.5] w-14 rounded-lg border border-white/10 bg-black/15 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] sm:w-16"
            />
          );
        }
        // j = position within the chunk being revealed now (0,1,2 for the flop) → left→right.
        const j = i - settled;
        const dealing = isRevealing && !reducedMotion;
        const dealDelay = dealing ? j * COMMUNITY.stagger : 0;
        const flipDelay = dealing ? dealDelay + COMMUNITY.dealMs + COMMUNITY.flipOffset : 0;
        const isWinning = highlightIds.has(card.id);
        return (
          <div
            key={card.id}
            className={`w-14 transition-transform sm:w-16 ${isWinning ? "holdem-win-shimmer -translate-y-1.5" : ""} ${
              isRiver && isRevealing ? "drop-shadow-[0_0_16px_rgba(244,214,128,0.75)]" : "drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]"
            } ${dealing ? "holdem-card-deal" : ""}`}
            style={
              dealing
                ? ({
                    ["--deal-delay" as string]: `${dealDelay}ms`,
                    ["--deal-dur" as string]: `${COMMUNITY.dealMs}ms`,
                    ["--deal-y" as string]: "-150px",
                    ["--deal-x" as string]: "0px",
                  } as CSSProperties)
                : undefined
            }
          >
            <FlipCard
              card={card}
              faceUp
              initialFaceDown={isRevealing}
              winning={isWinning}
              reducedMotion={reducedMotion}
              delayMs={flipDelay}
            />
          </div>
        );
      })}
    </div>
  );
}
