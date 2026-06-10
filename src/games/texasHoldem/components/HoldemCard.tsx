// games/texasHoldem/components/HoldemCard.tsx
// Hold'em-specific card rendering — a large, high-contrast playing card so the table reads as a
// card game, plus a branded back and a 3D flip wrapper (hero deal / community reveal / showdown).
//
// NOTE: deliberately does NOT use the shared CardFace.tsx (that one is tuned for Video Poker and
// must stay untouched). Font sizes use container-query units (cqw = % of card width) so the same
// face is crisp whether it's a small CPU card or a big community card.
import { useEffect, useState } from "react";
import type { Card } from "../types";
import { RANK_LABEL, SUIT_GLYPH, RED_SUITS } from "@/types/card";

function CornerIndex({ card, ink, className }: { card: Card; ink: string; className: string }) {
  return (
    <div className={`flex flex-col items-center leading-none ${className}`} style={{ color: ink }}>
      <span style={{ fontSize: "27cqw", fontWeight: 800, letterSpacing: "-0.04em" }}>{RANK_LABEL[card.rank]}</span>
      <span style={{ fontSize: "23cqw", marginTop: "-0.06em" }}>{SUIT_GLYPH[card.suit]}</span>
    </div>
  );
}

export function HoldemCardFront({ card, winning = false }: { card?: Card; winning?: boolean }) {
  if (!card) return <div className="h-full w-full rounded-[9%] bg-white/90" />;
  const red = RED_SUITS.includes(card.suit);
  const ink = red ? "#c81e2c" : "#16181d";
  return (
    <div
      className={`relative h-full w-full select-none rounded-[9%] bg-gradient-to-b from-white to-[#eceef2] ring-1 ${
        winning ? "ring-2 ring-[var(--gold-2)]" : "ring-black/15"
      }`}
      style={{
        containerType: "inline-size",
        boxShadow: winning
          ? "0 5px 12px rgba(0,0,0,0.45), 0 0 16px 3px rgba(244,214,128,0.65), inset 0 1px 0 rgba(255,255,255,0.95)"
          : "0 5px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.95)",
      }}
    >
      <CornerIndex card={card} ink={ink} className="absolute left-[8%] top-[5%]" />
      <CornerIndex card={card} ink={ink} className="absolute bottom-[5%] right-[8%] rotate-180" />
      <div className="flex h-full items-center justify-center" style={{ color: ink, fontSize: "56cqw", lineHeight: 1 }}>
        {SUIT_GLYPH[card.suit]}
      </div>
    </div>
  );
}

export function HoldemCardBack({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[9%] ring-1 ring-black/40 ${className}`}
      style={{
        containerType: "inline-size",
        background: "linear-gradient(150deg, #16294a 0%, #0a1424 100%)",
        boxShadow: "0 5px 12px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(233,196,106,0.18)",
      }}
      aria-label="face-down card"
    >
      <div
        className="absolute inset-[9%] rounded-[7%] border"
        style={{
          borderColor: "rgba(233,196,106,0.35)",
          backgroundImage: "repeating-linear-gradient(45deg, rgba(233,196,106,0.16) 0 5px, transparent 5px 11px)",
        }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ color: "rgba(233,196,106,0.5)", fontSize: "42cqw" }}
      >
        ♠
      </div>
    </div>
  );
}

type FlipCardProps = {
  card?: Card;
  faceUp: boolean;
  /** Mount face-down then flip up to `faceUp` after `delayMs` (fresh reveals / hero deal). */
  initialFaceDown?: boolean;
  winning?: boolean;
  reducedMotion?: boolean;
  delayMs?: number;
  className?: string;
};

/** Card that flips between the felt back and its face (spec §13 pseudo-3D flip). */
export function FlipCard({
  card,
  faceUp,
  initialFaceDown = false,
  winning = false,
  reducedMotion = false,
  delayMs = 0,
  className = "",
}: FlipCardProps) {
  const [revealed, setRevealed] = useState(initialFaceDown ? false : faceUp);

  useEffect(() => {
    if (initialFaceDown && faceUp) {
      const id = window.setTimeout(() => setRevealed(true), Math.max(0, delayMs) + 20);
      return () => window.clearTimeout(id);
    }
    setRevealed(faceUp);
    return undefined;
  }, [faceUp, initialFaceDown, delayMs]);

  return (
    <div className={`relative aspect-[2.5/3.5] w-full ${className}`} style={{ perspective: 900 }}>
      <div
        className={`holdem-flip ${revealed ? "is-face-up" : ""}`}
        style={{ transitionDuration: reducedMotion ? "0.1s" : undefined }}
      >
        <div className="holdem-flip-face holdem-flip-front">
          <HoldemCardFront card={card} winning={winning} />
        </div>
        <div className="holdem-flip-face holdem-flip-back">
          <HoldemCardBack />
        </div>
      </div>
    </div>
  );
}
