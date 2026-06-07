import { useCallback, useEffect, useRef, useState } from "react";
import type { Card } from "@/types/card";
import { VideoPokerCard } from "./VideoPokerCard";
import type { VideoPokerPhase } from "./useVideoPoker";

type VideoPokerTableProps = {
  hand: (Card | undefined)[];
  held: boolean[];
  phase: VideoPokerPhase;
  handId: number;
  winningCardIndexes: number[];
  onToggleHold: (index: number) => void;
  /** Tells the parent when a deal/draw animation is in flight (locks controls + hides result). */
  onAnimatingChange: (animating: boolean) => void;
};

const STAGGER = 90;
const DEAL_FLIP_LEAD = 160;
const FLIP_DUR = 380;
const DRAW_FLIP_LEAD = 220;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 5-card payline with the deal/replace animation timeline (spec §12.4–§12.7, §13). */
export function VideoPokerTable({
  hand,
  held,
  phase,
  handId,
  winningCardIndexes,
  onToggleHold,
  onAnimatingChange,
}: VideoPokerTableProps) {
  const [faceUp, setFaceUp] = useState<boolean[]>([false, false, false, false, false]);
  const [animating, setAnimating] = useState(false);
  const [revealWinners, setRevealWinners] = useState(false);

  const timers = useRef<number[]>([]);
  const reduce = useRef(prefersReducedMotion());
  const heldRef = useRef(held);
  heldRef.current = held;

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  }, []);
  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, reduce.current ? 0 : ms));
  }, []);

  useEffect(() => onAnimatingChange(animating), [animating, onAnimatingChange]);
  useEffect(() => clearTimers, [clearTimers]);

  // DEAL: face-down → staggered entrance → flip each face-up.
  useEffect(() => {
    if (handId === 0) return; // nothing dealt yet
    clearTimers();
    setRevealWinners(false);
    setFaceUp([false, false, false, false, false]);
    setAnimating(true);
    for (let i = 0; i < 5; i++) {
      after(i * STAGGER + DEAL_FLIP_LEAD, () =>
        setFaceUp((prev) => prev.map((f, idx) => (idx === i ? true : f))),
      );
    }
    after(4 * STAGGER + DEAL_FLIP_LEAD + FLIP_DUR, () => setAnimating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handId]);

  // DRAW: flip the replaced (non-held) cards back→front, then reveal winners.
  useEffect(() => {
    if (phase !== "result") return;
    clearTimers();
    const replaced = heldRef.current
      .map((isHeld, i) => (isHeld ? -1 : i))
      .filter((i) => i >= 0);

    if (replaced.length === 0) {
      setRevealWinners(true);
      return;
    }

    setAnimating(true);
    setFaceUp((prev) => prev.map((f, i) => (replaced.includes(i) ? false : f)));
    replaced.forEach((slot, k) => {
      after(k * STAGGER + DRAW_FLIP_LEAD, () =>
        setFaceUp((prev) => prev.map((f, i) => (i === slot ? true : f))),
      );
    });
    after(replaced.length * STAGGER + DRAW_FLIP_LEAD + FLIP_DUR, () => {
      setAnimating(false);
      setRevealWinners(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const interactive = phase === "draw" && !animating;

  return (
    <div className="rounded-2xl border border-neon-blue/20 bg-gradient-to-b from-neon-deep/40 to-black/60 p-4">
      <div className="flex items-end justify-center gap-2 sm:gap-3">
        {hand.map((card, i) => (
          <div key={i} className="w-[18%] max-w-[5.5rem]">
            <VideoPokerCard
              card={card}
              faceUp={faceUp[i] ?? false}
              held={held[i] ?? false}
              winning={revealWinners && winningCardIndexes.includes(i)}
              interactive={interactive}
              dealKey={handId}
              dealDelayMs={i * STAGGER}
              onToggleHold={() => onToggleHold(i)}
              ariaIndex={i + 1}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
