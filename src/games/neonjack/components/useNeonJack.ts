import { useCallback, useEffect, useRef, useState } from "react";
import type { Rate } from "@/types/casino";
import type { NeonJackSpinOutput, SlotSymbol } from "../types";
import { spin as runSpin } from "../logic/slotEngine";
import { REEL_STRIP, ROLE_REELS } from "../data/reels";
import { buildNeonJackResult, neonJackSpinCost } from "../adapter";
import { useCasinoStore } from "@/store/casinoStore";
import { pick } from "@/utils/random";

export type NeonJackPhase = "idle" | "spinning";

const STOP_DELAYS = [620, 900, 1200] as const; // staggered reel stops (ms)
const LAST_STOP = STOP_DELAYS[STOP_DELAYS.length - 1]!; // when the final reel locks
const CYCLE_MS = 70; // blur-cycle tick while spinning

type UseNeonJack = {
  reels: SlotSymbol[];
  spinningReels: boolean[];
  phase: NeonJackPhase;
  lastSpin: NeonJackSpinOutput | null;
  lampOn: boolean;
  spinCost: number;
  canSpin: boolean;
  spin: () => void;
};

/**
 * Orchestrates one NEON JACK spin against the casino economy:
 * placeBet (medals→chips) → run pure engine → animate stop → applyGameResult.
 * The engine itself is untouched; this hook is only the integration glue (spec §5.5).
 */
export function useNeonJack(rate: Rate, onInsufficient: () => void): UseNeonJack {
  const placeBet = useCasinoStore((s) => s.placeBet);
  const applyGameResult = useCasinoStore((s) => s.applyGameResult);
  const chips = useCasinoStore((s) => s.user?.chips ?? 0);

  const [reels, setReels] = useState<SlotSymbol[]>(["seven", "seven", "seven"]);
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false]);
  const [phase, setPhase] = useState<NeonJackPhase>("idle");
  const [lastSpin, setLastSpin] = useState<NeonJackSpinOutput | null>(null);
  const [lampOn, setLampOn] = useState(false);

  // Which reels have locked this spin (read by the blur-cycle interval).
  const stopped = useRef<boolean[]>([false, false, false]);
  const timers = useRef<number[]>([]);
  const cycle = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    if (cycle.current !== null) {
      clearInterval(cycle.current);
      cycle.current = null;
    }
  }, []);

  // Cleanup on unmount (mid-spin reload/navigation → no leaked timers; spec §12.6).
  useEffect(() => clearTimers, [clearTimers]);

  const spinCost = neonJackSpinCost(rate);
  const canSpin = phase === "idle" && chips >= spinCost;

  const spin = useCallback(() => {
    if (phase === "spinning") return;

    // Atomic bet (medals → chips). On failure, surface the rescue path.
    if (!placeBet("neonjack", spinCost)) {
      onInsufficient();
      return;
    }

    const out = runSpin();
    stopped.current = [false, false, false];
    setLastSpin(null);
    setLampOn(false);
    setPhase("spinning");
    setSpinningReels([true, true, true]);

    // Blur-cycle: rapidly randomise only the reels still spinning.
    cycle.current = window.setInterval(() => {
      setReels((prev) => prev.map((sym, i) => (stopped.current[i] ? sym : pick(REEL_STRIP))));
    }, CYCLE_MS);

    // Stagger the three reel stops onto the result payline.
    STOP_DELAYS.forEach((delay, i) => {
      const t = window.setTimeout(() => {
        stopped.current[i] = true;
        setReels((prev) => {
          const next = [...prev];
          next[i] = ROLE_REELS[out.role][i]!;
          return next;
        });
        setSpinningReels((prev) => {
          const next = [...prev];
          next[i] = false;
          return next;
        });
      }, delay);
      timers.current.push(t);
    });

    // After the last reel locks: settle the spin into the casino ledger.
    const settle = window.setTimeout(() => {
      if (cycle.current !== null) {
        clearInterval(cycle.current);
        cycle.current = null;
      }
      applyGameResult(buildNeonJackResult(out, rate));
      setLastSpin(out);
      setLampOn(out.lampOn);
      setPhase("idle");
    }, LAST_STOP + 200);
    timers.current.push(settle);
  }, [phase, placeBet, spinCost, onInsufficient, applyGameResult, rate]);

  return { reels, spinningReels, phase, lastSpin, lampOn, spinCost, canSpin, spin };
}
