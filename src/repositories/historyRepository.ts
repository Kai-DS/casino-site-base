// repositories/historyRepository.ts — read-side selectors over transactions/results.
// Pure functions (no IO); the store owns persistence via storage.ts. See spec §11.
import type { GameResult, GameId } from "@/types/game";
import type { ChipTransaction } from "@/types/casino";

/** Most-recent-first slice of play results. */
export function recentResults(results: readonly GameResult[], limit = 20): GameResult[] {
  return results.slice().reverse().slice(0, limit);
}

export type GameStats = {
  gameId: GameId;
  plays: number;
  wins: number;
  profit: number;
};

/** Per-game aggregates derived purely from results (used on the profile page). */
export function statsByGame(results: readonly GameResult[]): GameStats[] {
  const map = new Map<GameId, GameStats>();
  for (const r of results) {
    const s = map.get(r.gameId) ?? { gameId: r.gameId, plays: 0, wins: 0, profit: 0 };
    s.plays += 1;
    if (r.profit > 0) s.wins += 1;
    s.profit += r.profit;
    map.set(r.gameId, s);
  }
  return [...map.values()];
}

/** Most-recent-first slice of ledger entries. */
export function recentTransactions(
  transactions: readonly ChipTransaction[],
  limit = 30,
): ChipTransaction[] {
  return transactions.slice().reverse().slice(0, limit);
}
