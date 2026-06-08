import type { Card } from "@/types/card";
import { RANK_LABEL, SUIT_GLYPH, RED_SUITS } from "@/types/card";

type CardFaceProps = {
  card?: Card;
  faceDown?: boolean;
  held?: boolean;
  /** Highlight a winning card (spec §30). */
  winning?: boolean;
  /** Show the bottom "Hold" label (off when a parent renders its own Hold tab). */
  showHoldLabel?: boolean;
  className?: string;
};

/** Gameplay card (Suit/Rank). Distinct from the lobby's decorative PlayingCard. */
export function CardFace({
  card,
  faceDown = false,
  held = false,
  winning = false,
  showHoldLabel = true,
  className = "",
}: CardFaceProps) {
  if (faceDown || !card) {
    return (
      <div
        className={`aspect-[3/4.2] w-full rounded-lg border border-neon-green/40 bg-gradient-to-br from-neon-deepgreen to-black ${className}`}
        aria-label="face-down card"
      >
        <div className="flex h-full items-center justify-center text-neon-green/30">★</div>
      </div>
    );
  }

  const ink = RED_SUITS.includes(card.suit) ? "text-red-600" : "text-neutral-900";
  const ring = winning
    ? "ring-2 ring-gold-400"
    : held
      ? "ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)]"
      : "ring-black/10";

  return (
    <div
      className={`relative aspect-[3/4.2] w-full select-none rounded-lg bg-gradient-to-br from-white to-neutral-200 shadow-card ring-1 ${ring} ${className}`}
    >
      <div className={`absolute left-1.5 top-1 flex flex-col items-center leading-none ${ink}`}>
        <span className="text-base font-bold">{RANK_LABEL[card.rank]}</span>
        <span className="text-base">{SUIT_GLYPH[card.suit]}</span>
      </div>
      <div className={`flex h-full items-center justify-center ${ink}`}>
        <span className="text-3xl">{SUIT_GLYPH[card.suit]}</span>
      </div>
      {held && showHoldLabel && (
        <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-bold uppercase text-amber-500">
          Held
        </span>
      )}
    </div>
  );
}
