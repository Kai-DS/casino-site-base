import type { Card } from "@/types/card";
import { CardFace } from "@/components/casino/CardFace";

type VideoPokerTableProps = {
  hand: (Card | undefined)[];
  held: boolean[];
  phase: "unseated" | "buyIn" | "ready" | "draw" | "result";
  winningCardIndexes: number[];
  isAnimating: boolean;
  onToggleHold: (index: number) => void;
};

/** The 5-card payline. Cards toggle Hold during `draw`; winners glow on `result` (spec §12.4–§12.7). */
export function VideoPokerTable({
  hand,
  held,
  phase,
  winningCardIndexes,
  isAnimating,
  onToggleHold,
}: VideoPokerTableProps) {
  const interactive = phase === "draw" && !isAnimating;

  return (
    <div className="rounded-2xl border border-neon-blue/20 bg-gradient-to-b from-neon-deep/40 to-black/60 p-4">
      <div className="flex items-end justify-center gap-2 sm:gap-3">
        {hand.map((card, i) => {
          const isHeld = held[i] ?? false;
          const isWinning = phase === "result" && winningCardIndexes.includes(i);
          return (
            <div key={i} className="flex w-[18%] max-w-[5.5rem] flex-col items-center gap-1.5">
              {/* HOLD tab above the card (slot-stable) */}
              <span
                className={`text-[10px] font-bold uppercase tracking-wide transition-opacity ${
                  isHeld ? "text-neon-blue opacity-100" : "opacity-0"
                }`}
              >
                Hold
              </span>
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onToggleHold(i)}
                aria-label={isHeld ? `Release card ${i + 1}` : `Hold card ${i + 1}`}
                aria-pressed={isHeld}
                className="focus-ring w-full rounded-lg disabled:cursor-default"
              >
                <CardFace card={card} faceDown={!card} held={isHeld} winning={isWinning} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
