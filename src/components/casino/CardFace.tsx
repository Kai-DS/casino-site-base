import type { Card, Suit } from "@/types/card";

const SUIT_GLYPH: Record<Suit, string> = {
  spade: "♠",
  heart: "♥",
  diamond: "♦",
  club: "♣",
};

const RED: Suit[] = ["heart", "diamond"];

type CardFaceProps = {
  card?: Card;
  faceDown?: boolean;
  held?: boolean;
  className?: string;
};

/** Gameplay card (Suit/Rank). Distinct from the lobby's decorative PlayingCard. */
export function CardFace({ card, faceDown = false, held = false, className = "" }: CardFaceProps) {
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

  const ink = RED.includes(card.suit) ? "text-red-600" : "text-neutral-900";

  return (
    <div
      className={`relative aspect-[3/4.2] w-full select-none rounded-lg bg-gradient-to-br from-white to-neutral-200 shadow-card ring-1 transition ${
        held ? "ring-2 ring-gold-400 -translate-y-1" : "ring-black/10"
      } ${className}`}
    >
      <div className={`absolute left-1.5 top-1 flex flex-col items-center leading-none ${ink}`}>
        <span className="text-base font-bold">{card.rank}</span>
        <span className="text-base">{SUIT_GLYPH[card.suit]}</span>
      </div>
      <div className={`flex h-full items-center justify-center ${ink}`}>
        <span className="text-3xl">{SUIT_GLYPH[card.suit]}</span>
      </div>
      {held && (
        <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-bold uppercase text-gold-600">
          Hold
        </span>
      )}
    </div>
  );
}
