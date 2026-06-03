import type { CardSuit } from "@/types/game";

const SUIT_GLYPH: Record<CardSuit, string> = {
  spade: "♠",
  heart: "♥",
  diamond: "♦",
  club: "♣",
  joker: "★",
};

const RED_SUITS: CardSuit[] = ["heart", "diamond"];

export type PlayingCardProps = {
  rank: string;
  suit: CardSuit;
  /** Dimmed treatment for "coming soon" cards. */
  dimmed?: boolean;
  className?: string;
};

/** Trump-card-style face used as the lobby game selector (spec §7.3, world view preserved). */
export function PlayingCard({ rank, suit, dimmed = false, className = "" }: PlayingCardProps) {
  const isRed = RED_SUITS.includes(suit);
  const isJoker = suit === "joker";
  const ink = isJoker ? "text-purple-600" : isRed ? "text-red-600" : "text-neutral-900";

  return (
    <div
      className={`relative aspect-[3/4.2] w-full select-none rounded-xl bg-gradient-to-br from-white to-neutral-200 shadow-card ring-1 ring-black/10 ${
        dimmed ? "opacity-70 grayscale" : ""
      } ${className}`}
    >
      {/* corner index (top-left) */}
      <div className={`absolute left-2 top-1.5 flex flex-col items-center leading-none ${ink}`}>
        <span className="text-lg font-bold">{rank}</span>
        <span className="text-lg">{SUIT_GLYPH[suit]}</span>
      </div>
      {/* corner index (bottom-right, rotated) */}
      <div className={`absolute bottom-1.5 right-2 flex rotate-180 flex-col items-center leading-none ${ink}`}>
        <span className="text-lg font-bold">{rank}</span>
        <span className="text-lg">{SUIT_GLYPH[suit]}</span>
      </div>
      {/* center pip */}
      <div className={`flex h-full w-full items-center justify-center ${ink}`}>
        <span className={isJoker ? "text-4xl" : "text-5xl"}>{SUIT_GLYPH[suit]}</span>
      </div>
    </div>
  );
}
