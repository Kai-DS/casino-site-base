// games/texasHoldem/components/PotDisplay.tsx
// The central pot — a prominent gold-rimmed plate with a chip stack and an eased count-up that
// pulses when chips land (spec §24.4). The amount is whatever the logic says (game.pot.amount).
import { useEffect, useRef, useState } from "react";
import { ChipStack } from "@/components/casino/ChipStack";
import { formatChips } from "@/utils/format";
import { DURATION, EASING } from "./motion";

type PotDisplayProps = {
  amount: number;
  pulseKey: number;
  reducedMotion?: boolean;
};

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
      className={reducedMotion ? "" : "holdem-pot-pulse"}
      style={{ animationTimingFunction: EASING.entrance }}
    >
      <div className="flex items-center gap-2.5 rounded-full border border-[var(--rail)]/60 bg-black/55 px-4 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
        <ChipStack amount={display} showAmount={false} />
        <div className="flex flex-col leading-none">
          <span className="text-[9px] font-bold uppercase tracking-[0.32em] text-[var(--text-mid)]">Pot</span>
          <span className="font-display text-xl tabular-nums text-[var(--gold-2)]">{formatChips(display)}</span>
        </div>
      </div>
    </div>
  );
}
