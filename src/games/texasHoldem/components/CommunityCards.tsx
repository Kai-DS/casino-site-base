// games/texasHoldem/components/CommunityCards.tsx
// The board — the centrepiece. Flop / Turn / River reveal (spec §24.3, redesign): the cards are
// already in game state when the logic queues a REVEAL_* event, so this derives statelessly which
// trailing cards are "just arriving" and plays them DEALT-then-FLIPPED left→right, all inside the
// single event window (the queue calls onAnimationEventComplete once when the gate elapses).
import type { CSSProperties } from "react";
import type { AnimationEvent, Card } from "../types";
import { COMMUNITY } from "./motion";
import { FlipCard } from "./HoldemCard";

type CommunityCardsProps = {
  cards: Card[];
  activeEvent: AnimationEvent | null;
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

export function CommunityCards({ cards, activeEvent, reducedMotion = false, highlight }: CommunityCardsProps) {
  const total = cards.length;
  const revealing = revealingCount(activeEvent);
  const settled = total - revealing; // indices < settled are already face-up & static
  const isRiver = activeEvent?.type === "REVEAL_RIVER";
  const highlightIds = new Set((highlight ?? []).map((c) => c.id));

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const card = cards[i];
        if (!card) {
          return (
            <div
              key={`slot-${i}`}
              className="aspect-[2.5/3.5] w-14 rounded-lg border border-white/10 bg-black/15 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] sm:w-16"
            />
          );
        }
        const justRevealed = i >= settled;
        // j = position within the group currently being revealed (0,1,2 for the flop) → left→right.
        const j = i - settled;
        const dealing = justRevealed && !reducedMotion;
        const dealDelay = dealing ? j * COMMUNITY.stagger : 0;
        const flipDelay = dealing ? dealDelay + COMMUNITY.dealMs + COMMUNITY.flipOffset : 0;
        const isWinning = highlightIds.has(card.id);
        return (
          <div
            key={card.id}
            className={`w-14 transition-transform sm:w-16 ${isWinning ? "holdem-win-shimmer -translate-y-1.5" : ""} ${
              isRiver && justRevealed ? "drop-shadow-[0_0_16px_rgba(244,214,128,0.75)]" : "drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]"
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
              initialFaceDown={justRevealed}
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
