// games/shared/useStoreEconomy.ts — binds the real casinoStore to the GameEconomy contract.
// Production pages use this; the sandbox swaps in a mock instead.
import { useMemo } from "react";
import type { GameId } from "@/types/game";
import { useCasinoStore } from "@/store/casinoStore";
import type { GameEconomy } from "./economy";

type StoreEconomyOptions = {
  syncTableStack?: boolean;
};

export function useStoreEconomy(gameId: GameId, options: StoreEconomyOptions = {}): GameEconomy {
  // Store action identities are stable across renders; only balances change.
  const placeBetAction = useCasinoStore((s) => s.placeBet);
  const applyGameResult = useCasinoStore((s) => s.applyGameResult);
  const walletChips = useCasinoStore((s) => s.user?.chips ?? 0);
  const tableStack = useCasinoStore((s) => s.tableStack);
  const syncTableStack = options.syncTableStack !== false;
  const tableStackMode = syncTableStack ? "sync" : "ignore";
  const spendableChips = syncTableStack ? (tableStack ?? 0) : walletChips;

  return useMemo<GameEconomy>(
    () => ({
      chips: spendableChips,
      placeBet: (amount) => placeBetAction(gameId, amount, { tableStack: tableStackMode }),
      settle: (draft) => {
        applyGameResult(draft, { tableStack: tableStackMode });
      },
    }),
    [spendableChips, placeBetAction, applyGameResult, gameId, tableStackMode],
  );
}
