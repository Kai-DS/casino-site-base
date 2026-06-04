// games/shared/economy.ts — the minimal contract a game needs from the casino economy.
// Injecting this (instead of reaching into casinoStore) lets a game run two ways with the
// same logic: the real store in production, or a mock in the in-repo sandbox.
import type { GameResult } from "@/types/game";

/** What an adapter produces; the store fills id/userId/playedAt. */
export type GameResultDraft = Omit<GameResult, "id" | "userId" | "playedAt">;

export type GameEconomy = {
  /** Current spendable balance (reactive). */
  chips: number;
  /** Deduct a bet atomically. Returns false (and changes nothing) if unaffordable. */
  placeBet: (amount: number) => boolean;
  /** Settle a finished play (adds payout, records stats/ledger). */
  settle: (draft: GameResultDraft) => void;
};
