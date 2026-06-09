// games/texasHoldem/components/HoleCards.tsx
// A seat's two hole cards, dealt in an arch + flip, fanned slightly (spec §24.2).
// Which cards are visible is gated by `shownCount` (the deal stagger); whether a card's face
// shows is decided by `faceUp` (hero always; CPUs only after a showdown FLIP_HOLE).
import type { Card } from "../types";
import { FlipCard } from "./HoldemCard";

type HoleCardsProps = {
  cards: Card[];
  /** How many of the (up to 2) cards to render — drives the deal stagger gate. */
  shownCount: number;
  /** Reveal the card faces (hero, or a CPU after showdown). */
  faceUp: boolean;
  /** True only for the cards that just arrived (apply the deal-in flight). */
  dealingIndexes?: ReadonlySet<number>;
  hero?: boolean;
  reducedMotion?: boolean;
  /** Best-5 cards to highlight at showdown. */
  highlight?: Card[];
  className?: string;
};

const FAN = [-4, 4]; // §24.2 slight ±4° fan

export function HoleCards({
  cards,
  shownCount,
  faceUp,
  dealingIndexes,
  hero = false,
  reducedMotion = false,
  highlight,
  className = "",
}: HoleCardsProps) {
  const width = hero ? "w-14 sm:w-16" : "w-9 sm:w-10";
  const highlightIds = new Set((highlight ?? []).map((c) => c.id));

  return (
    <div className={`flex items-end justify-center ${hero ? "-space-x-2" : "-space-x-1.5"} ${className}`}>
      {[0, 1].map((i) => {
        if (i >= shownCount) return null;
        const card = cards[i];
        const dealing = dealingIndexes?.has(i) && !reducedMotion;
        const isWinning = card != null && highlightIds.has(card.id);
        return (
          <div
            key={card?.id ?? i}
            className={`${width} origin-bottom ${dealing ? "holdem-deal-in" : ""} ${isWinning ? "-translate-y-1.5" : ""} transition-transform`}
            style={{ transform: `rotate(${FAN[i] ?? 0}deg)`, ["--card-rot" as string]: `${FAN[i] ?? 0}deg` }}
          >
            <FlipCard
              card={card}
              faceUp={faceUp}
              initialFaceDown={Boolean(dealing && faceUp)}
              winning={isWinning}
              reducedMotion={reducedMotion}
            />
          </div>
        );
      })}
    </div>
  );
}
