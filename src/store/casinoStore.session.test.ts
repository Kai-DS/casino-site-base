import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCasinoStore } from "./casinoStore";
import { STARTING_CHIPS } from "@/repositories/userRepository";
import { RATE_BY_ID } from "@/constants/rates";

const get = () => useCasinoStore.getState();

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
  get().login("Tester"); // STARTING_CHIPS = 10,000
});

const MID = RATE_BY_ID.middle; // buyIn 1,000–5,000, bet 10–50

describe("casinoStore — buy-in", () => {
  it("buy-in does NOT move chips (wallet stays the single source of truth)", () => {
    get().buyIn(MID, 2000);
    expect(get().tableStack).toBe(2000);
    expect(get().user!.chips).toBe(STARTING_CHIPS); // unchanged
    expect(get().currentRate?.id).toBe("middle");
  });

  it("clamps the buy-in to [buyInMin, min(buyInMax, chips)]", () => {
    get().buyIn(MID, 999_999); // above buyInMax
    expect(get().tableStack).toBe(MID.buyInMax); // 5,000
    get().buyIn(MID, 1); // below buyInMin
    expect(get().tableStack).toBe(MID.buyInMin); // 1,000
  });

  it("rejects a table the wallet can't afford", () => {
    useCasinoStore.setState((s) => ({ user: { ...s.user!, chips: 500 } }));
    expect(get().buyIn(MID, 1000)).toBe(false);
    expect(get().tableStack).toBeNull();
  });
});

describe("casinoStore — stack lockstep with chips", () => {
  beforeEach(() => get().buyIn(MID, 2000));

  it("a bet decrements wallet AND stack by the same amount", () => {
    get().placeBet("videoPoker", 50);
    expect(get().user!.chips).toBe(STARTING_CHIPS - 50);
    expect(get().tableStack).toBe(2000 - 50);
  });

  it("a win increments wallet AND stack by the payout", () => {
    get().placeBet("videoPoker", 50);
    get().applyGameResult({ gameId: "videoPoker", bet: 50, payout: 300, profit: 250 });
    expect(get().user!.chips).toBe(STARTING_CHIPS - 50 + 300);
    expect(get().tableStack).toBe(2000 - 50 + 300);
  });

  it("rejects a bet the stack can't cover even when the wallet can", () => {
    get().buyIn(MID, 1000); // stack 1,000, wallet 10,000
    const ok = get().placeBet("videoPoker", 1500); // < wallet but > stack
    expect(ok).toBe(false);
    expect(get().tableStack).toBe(1000); // unchanged
    expect(get().user!.chips).toBe(STARTING_CHIPS);
  });

  it("re-buy tops the stack up toward min(buyInMax, chips)", () => {
    // burn the stack down
    for (let i = 0; i < 40; i++) get().placeBet("videoPoker", 50); // 2000 / 50 = 40 bets → stack 0
    expect(get().tableStack).toBe(0);
    expect(get().placeBet("videoPoker", 10)).toBe(false); // stack empty

    expect(get().rebuy(2000)).toBe(true);
    expect(get().tableStack).toBe(2000);
    expect(get().placeBet("videoPoker", 10)).toBe(true); // playable again
  });

  it("leaveTable clears the session without touching the wallet", () => {
    get().placeBet("videoPoker", 50);
    const chips = get().user!.chips;
    get().leaveTable();
    expect(get().tableStack).toBeNull();
    expect(get().currentRate).toBeNull();
    expect(get().user!.chips).toBe(chips); // net wealth = only the real bet outcome
  });
});
