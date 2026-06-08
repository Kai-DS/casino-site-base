import type { Card } from "@/types/card";
import { CardFace } from "@/components/casino/CardFace";

type VideoPokerCardProps = {
  card?: Card;
  /** Whether the front is showing (Table's animation timeline drives this). */
  faceUp: boolean;
  held: boolean;
  winning: boolean;
  /** Advisor suggests holding this card (non-destructive hint). */
  suggested: boolean;
  interactive: boolean;
  /** Bumped each DEAL so the entrance animation re-triggers (slot-stable key). */
  dealKey: number;
  dealDelayMs: number;
  onToggleHold: () => void;
  ariaIndex: number;
};

function CardBack() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-neon-green/40 bg-gradient-to-br from-neon-deepgreen to-black">
      <div className="h-[70%] w-[70%] rounded border border-neon-green/30 bg-[repeating-linear-gradient(45deg,rgba(47,224,138,0.14)_0,rgba(47,224,138,0.14)_4px,transparent_4px,transparent_8px)]" />
    </div>
  );
}

/** A single Video Poker card: pseudo-3D flip (back→front) + deal entrance + hold lift (spec §12.3–§12.5). */
export function VideoPokerCard({
  card,
  faceUp,
  held,
  winning,
  suggested,
  interactive,
  dealKey,
  dealDelayMs,
  onToggleHold,
  ariaIndex,
}: VideoPokerCardProps) {
  const showHint = suggested && !held;
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onToggleHold}
      aria-pressed={held}
      aria-label={held ? `Release card ${ariaIndex}` : `Hold card ${ariaIndex}`}
      className={`focus-ring perspective-card relative w-full rounded-lg transition-transform duration-200 disabled:cursor-default ${
        held ? "-translate-y-2" : ""
      }`}
    >
      {/* HELD badge — high contrast amber so it reads on the green LCD */}
      <span
        className={`pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded border border-amber-200 bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-black shadow-[0_0_10px_rgba(251,191,36,0.75)] transition-opacity ${
          held ? "opacity-100" : "opacity-0"
        }`}
      >
        Held
      </span>
      {/* Advisor hint (non-destructive): dashed ring + tag on cards you should hold */}
      {showHint && (
        <>
          <span className="pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-dashed border-amber-300/90 [animation:vpWinPulse_1.4s_ease-in-out_infinite]" />
          <span className="pointer-events-none absolute -bottom-2 left-1/2 z-10 -translate-x-1/2 rounded bg-amber-300 px-1.5 text-[9px] font-black uppercase text-black">
            Hold
          </span>
        </>
      )}
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
