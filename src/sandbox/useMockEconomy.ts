// sandbox/useMockEconomy.ts — an in-memory GameEconomy for the isolated sandbox.
// No store, no persistence, no auth: just chips you can reset/top-up + a play log,
// so game UI/feel can be polished without the lobby → rate → store flow in the way.
import { useCallback, useMemo, useRef, useState } from "react";
import type { GameEconomy, GameResultDraft } from "@/games/shared/economy";

export type LoggedPlay = GameResultDraft & { id: number; at: number };

export type MockEconomy = GameEconomy & {
  log: LoggedPlay[];
  plays: number;
  reset: (chips?: number) => void;
  topUp: (amount: number) => void;
};

export function useMockEconomy(initialChips = 1000): MockEconomy {
  const [chips, setChips] = useState(initialChips);
  const [log, setLog] = useState<LoggedPlay[]>([]);
  const chipsRef = useRef(chips);
  chipsRef.current = chips;
  const seq = useRef(0);

  const placeBet = useCallback((amount: number) => {
    if (chipsRef.current < amount) return false;
    setChips((c) => c - amount);
    return true;
  }, []);

  const settle = useCallback((draft: GameResultDraft) => {
    setChips((c) => c + draft.payout);
    setLog((l) => [{ ...draft, id: seq.current++, at: Date.now() }, ...l].slice(0, 50));
  }, []);

  const reset = useCallback((next = initialChips) => {
    setChips(next);
    setLog([]);
  }, [initialChips]);

  const topUp = useCallback((amount: number) => setChips((c) => c + amount), []);

  return useMemo<MockEconomy>(
    () => ({ chips, placeBet, settle, log, plays: log.length, reset, topUp }),
    [chips, placeBet, settle, log, reset, topUp],
  );
}
