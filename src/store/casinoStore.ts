// store/casinoStore.ts — runtime state + the ONLY place chips change.
// Every balance change is atomic: chips, cumulative stats, ledger tx and play
// record are updated inside a single set() call, then persisted once. See spec §5.4.
import { create } from "zustand";
import type { UserProfile, DailyBonus } from "@/types/user";
import type { ChipTransaction, Rate, TransactionSource } from "@/types/casino";
import type { GameId, GameResult } from "@/types/game";
import {
  loadRoot,
  saveRoot,
  clearAll,
  createDefaultRoot,
  type PersistedRoot,
} from "@/repositories/storage";
import { createGuestProfile, computeLevel } from "@/repositories/userRepository";
import { BANKRUPTCY_THRESHOLD } from "@/constants/rates";
import { isNewLocalDay, localDayKey, msSince, cooldownRemainingMinutes } from "@/utils/date";
import { uuid } from "@/utils/id";

export const RESCUE_AMOUNT = 1000;
export const RESCUE_COOLDOWN_MS = 60 * 60_000; // 60 minutes (spec §5.4)

type CasinoState = {
  // ── persisted slices ──
  user: UserProfile | null;
  transactions: ChipTransaction[];
  results: GameResult[];
  dailyBonus: DailyBonus;
  // ── runtime-only (never persisted; spec §5.2) ──
  currentRate: Rate | null;
  hydrated: boolean;

  // ── lifecycle ──
  hydrate: () => Promise<void>;
  login: (name: string) => void;
  logout: () => void;
  setRate: (rate: Rate | null) => void;

  // ── chip economy (atomic) ──
  placeBet: (gameId: GameId, amount: number) => boolean;
  applyGameResult: (result: Omit<GameResult, "id" | "userId" | "playedAt">) => GameResult | null;
  claimDailyBonus: () => boolean;
  rescue: () => boolean;

  // ── derived helpers (for event handlers; components may also select state) ──
  canClaimDailyBonus: () => boolean;
  canRescue: () => boolean;
  rescueCooldownMinutes: () => number;
};

/** Build the persisted root from current in-memory slices (currentRate is excluded). */
function toRoot(s: Pick<CasinoState, "user" | "transactions" | "results" | "dailyBonus">): PersistedRoot {
  return {
    schemaVersion: 1,
    user: s.user,
    transactions: s.transactions,
    results: s.results,
    dailyBonus: s.dailyBonus,
  };
}

export const useCasinoStore = create<CasinoState>((set, get) => {
  // Persist the latest snapshot. Fire-and-forget; localStorage is sync today, but
  // the async repository signature keeps callers stable for a future Supabase swap.
  const persist = () => {
    const { user, transactions, results, dailyBonus } = get();
    void saveRoot(toRoot({ user, transactions, results, dailyBonus })).catch((err) => {
      console.error("[casinoStore] saveRoot failed", err);
    });
  };

  const makeTx = (
    type: ChipTransaction["type"],
    gameId: GameId | null,
    amount: number,
    balanceAfter: number,
    source?: TransactionSource,
  ): ChipTransaction => ({
    id: uuid(),
    userId: get().user?.id ?? "unknown",
    gameId,
    type,
    ...(source ? { source } : {}),
    amount,
    balanceAfter,
    createdAt: new Date().toISOString(),
  });

  return {
    user: null,
    transactions: [],
    results: [],
    dailyBonus: createDefaultRoot().dailyBonus,
    currentRate: null,
    hydrated: false,

    async hydrate() {
      const root = await loadRoot();
      set({
        user: root.user,
        transactions: root.transactions,
        results: root.results,
        dailyBonus: root.dailyBonus,
        hydrated: true,
      });
    },

    login(name) {
      const user = createGuestProfile(name);
      set({
        user,
        transactions: [],
        results: [],
        dailyBonus: createDefaultRoot().dailyBonus,
        currentRate: null,
      });
      persist();
    },

    logout() {
      void clearAll();
      const fresh = createDefaultRoot();
      set({
        user: null,
        transactions: [],
        results: [],
        dailyBonus: fresh.dailyBonus,
        currentRate: null,
      });
    },

    setRate(rate) {
      set({ currentRate: rate });
    },

    placeBet(gameId, amount) {
      const { user } = get();
      if (!user) return false;
      if (!Number.isFinite(amount) || amount <= 0) return false;
      if (user.chips < amount) return false; // insufficient → no state change

      const balanceAfter = user.chips - amount;
      const tx = makeTx("bet", gameId, -amount, balanceAfter);
      set((s) => ({
        user: s.user ? { ...s.user, chips: balanceAfter, updatedAt: new Date().toISOString() } : s.user,
        transactions: [...s.transactions, tx],
      }));
      persist();
      return true;
    },

    applyGameResult(partial) {
      const { user } = get();
      if (!user) return null;

      const result: GameResult = {
        id: uuid(),
        userId: user.id,
        playedAt: new Date().toISOString(),
        ...partial,
      };

      const balanceAfter = user.chips + result.payout;
      const totalPlays = user.totalPlays + 1;
      const nextUser: UserProfile = {
        ...user,
        chips: balanceAfter,
        totalPlays,
        totalProfit: user.totalProfit + result.profit,
        wins: user.wins + (result.profit > 0 ? 1 : 0),
        level: computeLevel(totalPlays),
        updatedAt: new Date().toISOString(),
      };

      // Only log a ledger entry when chips actually move (skip 0-payout losses).
      const winTx =
        result.payout > 0 ? makeTx("win", result.gameId, result.payout, balanceAfter) : null;

      set((s) => ({
        user: nextUser,
        results: [...s.results, result],
        transactions: winTx ? [...s.transactions, winTx] : s.transactions,
      }));
      persist();
      return result;
    },

    claimDailyBonus() {
      const { user, dailyBonus } = get();
      if (!user) return false;
      if (!isNewLocalDay(dailyBonus.lastClaimedAt)) return false;

      const amount = dailyBonus.amount;
      const balanceAfter = user.chips + amount;
      const tx = makeTx("bonus", null, amount, balanceAfter, "daily");
      set((s) => ({
        user: s.user
          ? { ...s.user, chips: balanceAfter, updatedAt: new Date().toISOString() }
          : s.user,
        dailyBonus: { ...s.dailyBonus, lastClaimedAt: localDayKey() },
        transactions: [...s.transactions, tx],
      }));
      persist();
      return true;
    },

    rescue() {
      const { user, dailyBonus } = get();
      if (!user) return false;
      if (user.chips >= BANKRUPTCY_THRESHOLD) return false; // not bankrupt
      if (msSince(dailyBonus.lastRescuedAt) < RESCUE_COOLDOWN_MS) return false; // cooling down

      const balanceAfter = RESCUE_AMOUNT;
      const amount = RESCUE_AMOUNT - user.chips; // signed positive top-up
      const tx = makeTx("bonus", null, amount, balanceAfter, "rescue");
      set((s) => ({
        user: s.user
          ? { ...s.user, chips: balanceAfter, updatedAt: new Date().toISOString() }
          : s.user,
        dailyBonus: { ...s.dailyBonus, lastRescuedAt: new Date().toISOString() },
        transactions: [...s.transactions, tx],
      }));
      persist();
      return true;
    },

    canClaimDailyBonus() {
      const { user, dailyBonus } = get();
      return !!user && isNewLocalDay(dailyBonus.lastClaimedAt);
    },

    canRescue() {
      const { user, dailyBonus } = get();
      if (!user) return false;
      return user.chips < BANKRUPTCY_THRESHOLD && msSince(dailyBonus.lastRescuedAt) >= RESCUE_COOLDOWN_MS;
    },

    rescueCooldownMinutes() {
      return cooldownRemainingMinutes(get().dailyBonus.lastRescuedAt, RESCUE_COOLDOWN_MS);
    },
  };
});

/** Test-only: reset the store to a clean, hydrated state. */
export function __resetCasinoStoreForTest(): void {
  const fresh = createDefaultRoot();
  useCasinoStore.setState({
    user: null,
    transactions: [],
    results: [],
    dailyBonus: fresh.dailyBonus,
    currentRate: null,
    hydrated: true,
  });
}
