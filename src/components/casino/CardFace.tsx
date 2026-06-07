import type { Card } from "@/types/card";
import { RANK_LABEL, SUIT_GLYPH, RED_SUITS } from "@/types/card";

type CardFaceProps = {
  card?: Card;
  faceDown?: boolean;
  held?: boolean;
  /** Highlight a winning card (spec §30). */
  winning?: boolean;
  className?: string;
};

/** Gameplay card (Suit/Rank). Distinct from the lobby's decorative PlayingCard. */
export function CardFace({ card, faceDown = false, held = false, winning = false, className = "" }: CardFaceProps) {
  if (faceDown || !card) {
    return (
      <div
        className={`aspect-[3/4.2] w-full rounded-lg border border-neon-blue/40 bg-gradient-to-br from-neon-deep to-black ${className}`}
        aria-label="face-down card"
      >
        <div className="flex h-full items-center justify-center text-neon-blue/30">★</div>
      </div>
    );
  }

  const ink = RED_SUITS.includes(card.suit) ? "text-red-600" : "text-neutral-900";
  const ring = winning ? "ring-2 ring-gold-400 shadow-gold" : held ? "ring-2 ring-neon-blue" : "ring-black/10";

  return (
    <div
      className={`relative aspect-[3/4.2] w-full select-none rounded-lg bg-gradient-to-br from-white to-neutral-200 shadow-card ring-1 transition ${
        held || winning ? "-translate-y-1" : ""
      } ${ring} ${className}`}
    >
      <div className={`absolute left-1.5 top-1 flex flex-col items-center leading-none ${ink}`}>
        <span className="text-base font-bold">{RANK_LABEL[card.rank]}</span>
        <span className="text-base">{SUIT_GLYPH[card.suit]}</span>
      </div>
      <div className={`flex h-full items-center justify-center ${ink}`}>
        <span className="text-3xl">{SUIT_GLYPH[card.suit]}</span>
      </div>
      {held && (
        <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-bold uppercase text-neon-blue">
          Hold
        </span>
      )}
    </div>
  );
}
