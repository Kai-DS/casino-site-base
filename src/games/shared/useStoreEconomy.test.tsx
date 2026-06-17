// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_BY_ID } from "@/constants/rates";
import { STARTING_CHIPS } from "@/repositories/userRepository";
import { __resetCasinoStoreForTest, useCasinoStore } from "@/store/casinoStore";
import type { GameEconomy } from "./economy";
import { useStoreEconomy } from "./useStoreEconomy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LOW = RATE_BY_ID.low;

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

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  installLocalStorageMock();
  __resetCasinoStoreForTest();
  useCasinoStore.getState().login("Tester");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function renderStoreEconomy(options?: Parameters<typeof useStoreEconomy>[1]) {
  let economy: GameEconomy | null = null;

  function Harness() {
    economy = useStoreEconomy("roulette", options);
    return null;
  }

  act(() => root.render(<Harness />));

  return {
    get economy() {
      if (!economy) throw new Error("useStoreEconomy did not render");
      return economy;
    },
  };
}

describe("useStoreEconomy", () => {
  it("uses the store tableStack as the spendable balance when stack syncing is enabled", () => {
    expect(useCasinoStore.getState().buyIn(LOW, 100)).toBe(true);
    const h = renderStoreEconomy();

    expect(h.economy.chips).toBe(100);

    act(() => {
      expect(h.economy.placeBet(80)).toBe(true);
    });
    expect(useCasinoStore.getState().user!.chips).toBe(STARTING_CHIPS - 80);
    expect(useCasinoStore.getState().tableStack).toBe(20);
    expect(h.economy.chips).toBe(20);

    act(() => {
      expect(h.economy.placeBet(30)).toBe(false);
    });
    expect(useCasinoStore.getState().user!.chips).toBe(STARTING_CHIPS - 80);
    expect(useCasinoStore.getState().tableStack).toBe(20);

    act(() => {
      h.economy.settle({ gameId: "roulette", bet: 80, payout: 120, profit: 40 });
    });
    expect(useCasinoStore.getState().user!.chips).toBe(STARTING_CHIPS + 40);
    expect(useCasinoStore.getState().tableStack).toBe(140);
    expect(h.economy.chips).toBe(140);
  });

  it("keeps hook-owned table stacks on wallet chips when stack syncing is disabled", () => {
    expect(useCasinoStore.getState().buyIn(LOW, 100)).toBe(true);
    const h = renderStoreEconomy({ syncTableStack: false });

    expect(h.economy.chips).toBe(STARTING_CHIPS);

    act(() => {
      expect(h.economy.placeBet(80)).toBe(true);
    });
    expect(useCasinoStore.getState().user!.chips).toBe(STARTING_CHIPS - 80);
    expect(useCasinoStore.getState().tableStack).toBe(100);
    expect(h.economy.chips).toBe(STARTING_CHIPS - 80);
  });
});
