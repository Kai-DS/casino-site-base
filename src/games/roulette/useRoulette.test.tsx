// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Rate } from "@/types/casino";
import type { GameEconomy, GameResultDraft } from "@/games/shared/economy";
import { useRoulette, type UseRouletteOptions } from "./useRoulette";
import type { UseRouletteReturn } from "./types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RATE: Rate = {
  id: "low",
  label: "Roulette Test",
  buyInMin: 100,
  buyInMax: 1_000,
  betMin: 10,
  betMax: 50,
  blurb: "test",
};

type TestEconomy = GameEconomy & {
  placeBet: ReturnType<typeof vi.fn<(amount: number) => boolean>>;
  settle: ReturnType<typeof vi.fn<(draft: GameResultDraft) => void>>;
};

function makeEconomy(initialChips = 1_000): TestEconomy {
  let chips = initialChips;
  return {
    get chips() {
      return chips;
    },
    placeBet: vi.fn((amount: number) => {
      if (chips < amount) return false;
      chips -= amount;
      return true;
    }),
    settle: vi.fn((draft: GameResultDraft) => {
      chips += draft.payout;
    }),
  };
}

const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  vi.restoreAllMocks();
});

function renderRoulette({
  economy = makeEconomy(),
  animationEnabled = true,
  resultProvider = () => 17,
  rate = RATE,
}: Partial<UseRouletteOptions> = {}) {
  let current: UseRouletteReturn | null = null;
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);

  function Harness() {
    current = useRoulette({
      rate,
      economy,
      animationEnabled,
      resultProvider,
    });
    return null;
  }

  act(() => root.render(<Harness />));

  return {
    economy,
    get current() {
      if (!current) throw new Error("useRoulette did not render");
      return current;
    },
  };
}

function ackHead(h: ReturnType<typeof renderRoulette>) {
  const event = h.current.animationEvents[0];
  if (!event) throw new Error("No roulette animation event to acknowledge");
  act(() => {
    h.current.onAnimationEventComplete(event.id);
  });
}

function placeFixedExample(h: ReturnType<typeof renderRoulette>) {
  act(() => {
    expect(h.current.placeChip("straight-17")).toEqual({ ok: true });
    h.current.selectChip(20);
  });
  act(() => {
    expect(h.current.placeChip("dozen-2")).toEqual({ ok: true });
    h.current.selectChip(10);
  });
  act(() => {
    expect(h.current.placeCallBet("orphelins")).toEqual({ ok: true });
  });
}

describe("useRoulette", () => {
  it("drives one animated spin to result with staged economy calls", () => {
    const h = renderRoulette();
    placeFixedExample(h);

    expect(h.current.state.stagedTotal).toBe(80);
    expect(h.economy.placeBet).not.toHaveBeenCalled();

    act(() => {
      expect(h.current.spin()).toEqual({ ok: true });
    });

    expect(h.economy.placeBet).toHaveBeenCalledTimes(1);
    expect(h.economy.placeBet).toHaveBeenCalledWith(80);
    expect(h.economy.chips).toBe(920);
    expect(h.current.animationEvents.map((event) => event.type)).toEqual([
      "NO_MORE_BETS",
      "SPIN_START",
      "BALL_LAND",
      "MARK_WINNER",
      "COLLECT_LOSING",
      "PAY_WINNING",
      "RESULT_BANNER",
    ]);

    while (h.current.animationEvents.length > 0) ackHead(h);

    expect(h.current.state.phase).toBe("result");
    expect(h.current.state.settled).toBe(true);
    expect(h.current.state.history.map((result) => result.number)).toEqual([17]);
    expect(h.current.state.settlement).toMatchObject({
      totalBet: 80,
      totalReturned: 780,
      profit: 700,
    });
    expect(h.economy.settle).toHaveBeenCalledTimes(1);
    expect(h.economy.settle).toHaveBeenCalledWith({
      gameId: "roulette",
      bet: 80,
      payout: 780,
      profit: 700,
    });
    expect(h.economy.chips).toBe(1_700);
  });

  it("locks actions while animation events are pending", () => {
    const h = renderRoulette();
    act(() => {
      h.current.placeChip("straight-17");
      h.current.spin();
    });

    expect(h.current.isAnimating).toBe(true);
    expect(h.current.placeChip("straight-18")).toMatchObject({ ok: false, reason: "ANIMATING" });
    expect(h.current.spin()).toMatchObject({ ok: false, reason: "ANIMATING" });
    expect(Object.values(h.current.availableActions).every((action) => !action.enabled && action.reason === "ANIMATING")).toBe(true);
  });

  it("rebets with new bet and group ids, and rejects unaffordable rebets atomically", () => {
    const h = renderRoulette({ animationEnabled: false });
    act(() => {
      expect(h.current.placeCallBet("orphelins")).toEqual({ ok: true });
      expect(h.current.spin()).toEqual({ ok: true });
    });
    const previousIds = new Set(h.current.state.lastBets?.map((bet) => bet.betId));
    const previousGroupIds = new Set(h.current.state.lastBets?.map((bet) => bet.groupId).filter(Boolean));

    act(() => {
      expect(h.current.rebet()).toEqual({ ok: true });
    });

    expect(h.current.state.phase).toBe("betting");
    expect(h.current.state.bets.map((bet) => bet.positionId)).toEqual([
      "straight-1",
      "split-6-9",
      "split-14-17",
      "split-17-20",
      "split-31-34",
    ]);
    expect(h.current.state.bets.every((bet) => !previousIds.has(bet.betId))).toBe(true);
    expect(h.current.state.bets.every((bet) => bet.groupId && !previousGroupIds.has(bet.groupId))).toBe(true);

    const poor = renderRoulette({ economy: makeEconomy(50), animationEnabled: false, resultProvider: () => 2 });
    act(() => {
      expect(poor.current.placeCallBet("orphelins")).toEqual({ ok: true });
      expect(poor.current.spin()).toEqual({ ok: true });
    });
    const before = poor.current.state;
    act(() => {
      expect(poor.current.rebet()).toMatchObject({ ok: false, reason: "INSUFFICIENT_FUNDS" });
    });
    expect(poor.current.state.phase).toBe(before.phase);
    expect(poor.current.state.bets).toEqual(before.bets);
  });

  it("flushes a pending settlement once", () => {
    const h = renderRoulette();
    act(() => {
      h.current.placeChip("straight-17");
      h.current.spin();
    });

    expect(h.current.state.settled).toBe(false);
    expect(h.economy.settle).not.toHaveBeenCalled();

    act(() => {
      h.current.flushPendingSettlement();
    });

    expect(h.current.state.phase).toBe("result");
    expect(h.current.state.settled).toBe(true);
    expect(h.current.animationEvents).toHaveLength(0);
    expect(h.current.state.history.map((result) => result.number)).toEqual([17]);
    expect(h.economy.settle).toHaveBeenCalledTimes(1);
    expect(h.economy.chips).toBe(1_350);

    act(() => {
      h.current.flushPendingSettlement();
    });
    expect(h.economy.settle).toHaveBeenCalledTimes(1);
  });
});
