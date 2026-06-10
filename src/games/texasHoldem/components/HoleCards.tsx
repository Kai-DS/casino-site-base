// games/texasHoldem/components/HoleCards.tsx
// A seat's two hole cards, dealt in + flipped, fanned slightly (spec §24.2). Visual hierarchy is
// community > hero > CPU, so the hero cards are readable but smaller than the board; CPU cards are
// smaller still. `shownCount` gates the deal stagger; `faceUp` decides whether faces show.
import type { Card } from "../types";
import { FlipCard } from "./HoldemCard";

type HoleCardsProps = {
  cards: Card[];
  shownCount: number;
  faceUp: boolean;
  dealingIndexes?: ReadonlySet<number>;
  hero?: boolean;
  reducedMotion?: boolean;
  highlight?: Card[];
  className?: string;
};

const FAN = [-5, 5]; // §24.2 slight ±5° fan

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
  // community (w-14/16) > hero (w-11/12) > cpu (w-9/10)
  const width = hero ? "w-11 sm:w-12" : "w-9 sm:w-10";
  const highlightIds = new Set((highlight ?? []).map((c) => c.id));

  return (
    <div className={`group/hole flex items-end justify-center ${hero ? "-space-x-2.5" : "-space-x-2"} ${className}`}>
      {[0, 1].map((i) => {
        if (i >= shownCount) return null;
        const card = cards[i];
        const dealing = dealingIndexes?.has(i) && !reducedMotion;
        const isWinning = card != null && highlightIds.has(card.id);
        return (
          <div
            key={card?.id ?? i}
            className={`${width} origin-bottom drop-shadow-[0_5px_9px_rgba(0,0,0,0.5)] transition-transform ${
              dealing ? "holdem-deal-in" : ""
            } ${isWinning ? "-translate-y-2" : ""} ${hero ? "hover:-translate-y-1.5" : ""}`}
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
