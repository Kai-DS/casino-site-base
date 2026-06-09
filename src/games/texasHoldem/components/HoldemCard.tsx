// games/texasHoldem/components/HoldemCard.tsx
// Internal card helpers for the Hold'em table: a felt-toned card back and a 3D flip wrapper
// shared by the hero deal, community reveal, and showdown reveals. Front face reuses the
// shared CardFace renderer (spec §28.2).
import { useEffect, useState } from "react";
import type { Card } from "../types";
import { CardFace } from "@/components/casino/CardFace";

export function HoldemCardBack({ className = "" }: { className?: string }) {
  return (
    <div
      className={`aspect-[3/4.2] w-full overflow-hidden rounded-lg border border-[var(--rail)]/60 ${className}`}
      style={{
        background:
          "repeating-linear-gradient(45deg, rgba(233,196,106,0.10) 0 6px, transparent 6px 12px), linear-gradient(160deg, var(--bg-navy), #060d16)",
        boxShadow: "inset 0 0 0 2px rgba(233,196,106,0.18)",
      }}
      aria-label="face-down card"
    >
      <div className="flex h-full items-center justify-center text-[var(--rail-hi)]/40">♠</div>
    </div>
  );
}

type FlipCardProps = {
  card?: Card;
  /** Target state. Animates back→front when this flips false→true. */
  faceUp: boolean;
  /**
   * Mount face-down and flip up to `faceUp` after `delayMs`. Use for freshly-mounted cards
   * that need the reveal animation (community cards, the hero deal) — without it a fresh
   * face-up card would just appear with no flip.
   */
  initialFaceDown?: boolean;
  winning?: boolean;
  reducedMotion?: boolean;
  /** Stagger delay before the flip starts. */
  delayMs?: number;
  className?: string;
};

/** Card that flips between a felt back and its face (spec §13 pseudo-3D flip). */
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
    <div className={`aspect-[3/4.2] w-full ${className}`} style={{ perspective: 900 }}>
      <div
        className={`holdem-flip ${revealed ? "is-face-up" : ""}`}
        style={{ transitionDuration: reducedMotion ? "0.1s" : undefined }}
      >
        <div className="holdem-flip-face holdem-flip-front">
          <CardFace card={card} showHoldLabel={false} winning={winning} />
        </div>
        <div className="holdem-flip-face holdem-flip-back">
          <HoldemCardBack />
        </div>
      </div>
    </div>
  );
}
