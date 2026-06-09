// games/texasHoldem/components/CommunityCards.tsx
// Flop / Turn / River reveal (spec §24.3). The cards themselves already live in game state the
// moment the logic queues a REVEAL_* event, so this derives — statelessly — how many are
// "settled" vs "just arriving" from the active event, and flips the new ones in.
import type { AnimationEvent, Card } from "../types";
import { STAGGER } from "./motion";
import { FlipCard } from "./HoldemCard";

type CommunityCardsProps = {
  cards: Card[];
  activeEvent: AnimationEvent | null;
  reducedMotion?: boolean;
  /** Winning best-5 cards to highlight at showdown. */
  highlight?: Card[];
};

/** How many trailing community cards the active REVEAL event is bringing in. */
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
    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
      {Array.from({ length: 5 }).map((_, i) => {
        const card = cards[i];
        if (!card) {
          // Empty community slot placeholder.
          return <div key={`slot-${i}`} className="aspect-[3/4.2] w-10 rounded-lg border border-white/10 bg-black/20 sm:w-12" />;
        }
        const justRevealed = i >= settled;
        const delay = justRevealed && !reducedMotion ? (i - settled) * STAGGER.community : 0;
        const isWinning = highlightIds.has(card.id);
        return (
          <div
            key={card.id}
            className={`w-10 sm:w-12 ${isWinning ? "holdem-win-shimmer -translate-y-1" : ""} ${
              isRiver && justRevealed ? "drop-shadow-[0_0_12px_rgba(233,196,106,0.7)]" : ""
            } transition-transform`}
          >
            <FlipCard
              card={card}
              faceUp
              initialFaceDown={justRevealed}
              winning={isWinning}
              reducedMotion={reducedMotion}
              delayMs={delay}
            />
          </div>
        );
      })}
    </div>
  );
}
