import type { Card } from "@/types/card";
import { CardFace } from "@/components/casino/CardFace";

type VideoPokerCardProps = {
  card?: Card;
  /** Whether the front is showing (Table's animation timeline drives this). */
  faceUp: boolean;
  held: boolean;
  winning: boolean;
  interactive: boolean;
  /** Bumped each DEAL so the entrance animation re-triggers (slot-stable key). */
  dealKey: number;
  dealDelayMs: number;
  onToggleHold: () => void;
  ariaIndex: number;
};

function CardBack() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-neon-blue/40 bg-gradient-to-br from-neon-deep to-black">
      <div className="h-[70%] w-[70%] rounded border border-neon-blue/30 bg-[repeating-linear-gradient(45deg,rgba(40,215,255,0.12)_0,rgba(40,215,255,0.12)_4px,transparent_4px,transparent_8px)]" />
    </div>
  );
}

/** A single Video Poker card: pseudo-3D flip (back→front) + deal entrance + hold lift (spec §12.3–§12.5). */
export function VideoPokerCard({
  card,
  faceUp,
  held,
  winning,
  interactive,
  dealKey,
  dealDelayMs,
  onToggleHold,
  ariaIndex,
}: VideoPokerCardProps) {
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onToggleHold}
      aria-pressed={held}
      aria-label={held ? `Release card ${ariaIndex}` : `Hold card ${ariaIndex}`}
      className={`focus-ring perspective-card w-full rounded-lg transition-transform duration-200 disabled:cursor-default ${
        held ? "-translate-y-1.5" : ""
      }`}
    >
      <div key={dealKey} className="vp-card-in" style={{ animationDelay: `${dealDelayMs}ms` }}>
        <div className={`vp-flip relative aspect-[3/4.2] w-full ${faceUp ? "is-face-up" : ""}`}>
          {/* Front */}
          <div className={`absolute inset-0 backface-hidden ${winning && faceUp ? "vp-win-glow" : ""}`}>
            <CardFace card={card} held={held} winning={winning} showHoldLabel={false} />
          </div>
          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180">
            <CardBack />
          </div>
        </div>
      </div>
    </button>
  );
}
