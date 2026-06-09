// games/texasHoldem/components/PotDisplay.tsx
// The central pot: a chip stack + a count-up number that pulses when chips land (spec §24.4).
// The amount is whatever the logic says (game.pot.amount) — never computed here.
import { useEffect, useRef, useState } from "react";
import { ChipStack } from "@/components/casino/ChipStack";
import { DURATION, EASING } from "./motion";

type PotDisplayProps = {
  amount: number;
  /** Bumped by the queue on each chip-to-pot so the pot pulses. */
  pulseKey: number;
  reducedMotion?: boolean;
};

/** Eased count-up toward `target` (spec §24.4: pot counts up with EASING.entrance). */
function useCountUp(target: number, durationMs: number, reducedMotion: boolean): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion || durationMs <= 0) {
      setValue(target);
      fromRef.current = target;
      return undefined;
    }
    const from = fromRef.current;
    if (from === target) return undefined;
    const start = performance.now();
    // EASING.entrance ≈ ease-out-expo.
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(from + (target - from) * ease(p)));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs, reducedMotion]);

  return value;
}

export function PotDisplay({ amount, pulseKey, reducedMotion = false }: PotDisplayProps) {
  const display = useCountUp(amount, DURATION.slow, reducedMotion);

  if (amount <= 0 && display <= 0) return null;

  return (
    <div
      key={pulseKey}
      className={`flex flex-col items-center gap-1 ${reducedMotion ? "" : "holdem-pot-pulse"}`}
      style={{ animationTimingFunction: EASING.entrance }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--text-mid)]">Pot</span>
      <div className="rounded-full border border-[var(--rail)]/40 bg-black/40 px-3 py-1 shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
        <ChipStack amount={display} />
      </div>
    </div>
  );
}
