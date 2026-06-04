// games/shared/useStoreEconomy.ts — binds the real casinoStore to the GameEconomy contract.
// Production pages use this; the sandbox swaps in a mock instead.
import { useMemo } from "react";
import type { GameId } from "@/types/game";
import { useCasinoStore } from "@/store/casinoStore";
import type { GameEconomy } from "./economy";

export function useStoreEconomy(gameId: GameId): GameEconomy {
  // Store action identities are stable across renders; only `chips` changes.
  const placeBetAction = useCasinoStore((s) => s.placeBet);
  const applyGameResult = useCasinoStore((s) => s.applyGameResult);
  const chips = useCasinoStore((s) => s.user?.chips ?? 0);

  return useMemo<GameEconomy>(
    () => ({
      chips,
      placeBet: (amount) => placeBetAction(gameId, amount),
      settle: (draft) => {
        applyGameResult(draft);
      },
    }),
    [chips, placeBetAction, applyGameResult, gameId],
  );
}
