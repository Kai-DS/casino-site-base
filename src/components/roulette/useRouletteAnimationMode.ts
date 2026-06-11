// components/roulette/useRouletteAnimationMode.ts
// A tiny persisted-state hook for the spin animation mode (addendum §3). Keeps the chosen mode in
// React state + localStorage so it survives reloads.
import { useCallback, useState } from "react";
import {
  type RouletteAnimationMode,
  loadAnimationMode,
  saveAnimationMode,
} from "./animationMode";

export interface UseRouletteAnimationMode {
  mode: RouletteAnimationMode;
  setMode: (mode: RouletteAnimationMode) => void;
}

export function useRouletteAnimationMode(): UseRouletteAnimationMode {
  const [mode, setModeState] = useState<RouletteAnimationMode>(() => loadAnimationMode());

  const setMode = useCallback((next: RouletteAnimationMode) => {
    setModeState(next);
    saveAnimationMode(next);
  }, []);

  return { mode, setMode };
}
