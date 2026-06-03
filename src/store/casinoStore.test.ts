import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCasinoStore, RESCUE_AMOUNT } from "./casinoStore";
import { STARTING_CHIPS } from "@/repositories/userRepository";

const get = () => useCasinoStore.getState();

// Minimal in-memory Storage so the test doesn't depend on jsdom/Node localStorage quirks.
function installLocalStorageMock() {
  const map = new Map<string, string>();
  const mock: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
  };
  vi.stubGlobal("localStorage", mock);
}

beforeEach(() => {
  installLocalStorageMock();
  localStorage.clear();
  get().login("Tester");
});

describe("casinoStore — placeBet", () => {
  it("deducts chips and writes a signed bet ledger entry (balanceAfter === chips)", () => {
    const ok = get().placeBet("neonjack", 3);
    expect(ok).toBe(true);

    const s = get();
    expect(s.user!.chips).toBe(STARTING_CHIPS - 3);

    const tx = s.transactions.at(-1)!;
    expect(tx.type).toBe("bet");
    expect(tx.amount).toBe(-3);
    expect(tx.balanceAfter).toBe(s.user!.chips);
  });

  it("rejects a bet larger than the balance and leaves state untouched", () => {
    const before = get().user!.chips;
    const ok = get().placeBet("neonjack", before + 1);
    expect(ok).toBe(false);
    expect(get().user!.chips).toBe(before);
    expect(get().transactions).toHaveLength(0);
  });
});

describe("casinoStore — applyGameResult", () => {
  it("adds payout, updates cumulative stats, and keeps balanceAfter === chips on a win", () => {
    get().placeBet("neonjack", 3); // chips: 9997
    get().applyGameResult({ gameId: "neonjack", bet: 3, payout: 8, profit: 5 });

    const s = get();
    expect(s.user!.chips).toBe(STARTING_CHIPS - 3 + 8);
    expect(s.user!.totalPlays).toBe(1);
    expect(s.user!.totalProfit).toBe(5);
    expect(s.user!.wins).toBe(1);

    const win = s.transactions.at(-1)!;
    expect(win.type).toBe("win");
    expect(win.amount).toBe(8);
    expect(win.balanceAfter).toBe(s.user!.chips);
  });

  it("records a losing play (no win ledger entry) but still counts the play", () => {
    get().placeBet("neonjack", 3);
    get().applyGameResult({ gameId: "neonjack", bet: 3, payout: 0, profit: -3 });

    const s = get();
    expect(s.user!.chips).toBe(STARTING_CHIPS - 3);
    expect(s.user!.totalPlays).toBe(1);
    expect(s.user!.wins).toBe(0);
    expect(s.results).toHaveLength(1);
    // Only the bet tx exists — no zero-amount win entry.
    expect(s.transactions.filter((t) => t.type === "win")).toHaveLength(0);
  });

  it("level follows floor(totalPlays / 50) + 1", () => {
    for (let i = 0; i < 50; i++) {
      get().applyGameResult({ gameId: "neonjack", bet: 0, payout: 0, profit: 0 });
    }
    expect(get().user!.totalPlays).toBe(50);
    expect(get().user!.level).toBe(2);
  });
});

describe("casinoStore — dailyBonus & rescue", () => {
  it("daily bonus can be claimed once per local day", () => {
    expect(get().canClaimDailyBonus()).toBe(true);
    expect(get().claimDailyBonus()).toBe(true);
    expect(get().user!.chips).toBe(STARTING_CHIPS + 1000);
    expect(get().claimDailyBonus()).toBe(false); // already today
  });

  it("rescue only fires when bankrupt, then enters cooldown", () => {
    expect(get().rescue()).toBe(false); // not bankrupt

    useCasinoStore.setState((s) => ({ user: { ...s.user!, chips: 50 } }));
    expect(get().canRescue()).toBe(true);
    expect(get().rescue()).toBe(true);
    expect(get().user!.chips).toBe(RESCUE_AMOUNT);

    expect(get().canRescue()).toBe(false); // 60-min cooldown
    expect(get().rescue()).toBe(false);
  });
});

describe("casinoStore — ledger integrity invariant", () => {
  it("chips always equal STARTING + Σ(tx.amount), and every balanceAfter matches the running total", () => {
    const payouts = [0, 8, 2, 240, 0, 3, 96, 0, 8, 0];
    for (const payout of payouts) {
      get().placeBet("neonjack", 3);
      get().applyGameResult({ gameId: "neonjack", bet: 3, payout, profit: payout - 3 });
    }
    get().claimDailyBonus();

    const s = get();
    let running = STARTING_CHIPS;
    for (const tx of s.transactions) {
      running += tx.amount;
      expect(tx.balanceAfter).toBe(running);
    }
    expect(s.user!.chips).toBe(running);
    expect(s.user!.chips).toBe(STARTING_CHIPS + s.transactions.reduce((a, t) => a + t.amount, 0));
  });
});
