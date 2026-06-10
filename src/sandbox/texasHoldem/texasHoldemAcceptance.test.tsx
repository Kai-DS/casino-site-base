// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameEconomy, GameResultDraft } from "@/games/shared/economy";
import { validatePokerDeck } from "@/games/shared/poker/deck";
import { useTexasHoldem, type UseTexasHoldemReturn } from "@/games/texasHoldem/useTexasHoldem";
import type { Rate } from "@/types/casino";
import {
  findHoldemSandboxScenario,
  HOLDEM_SANDBOX_SCENARIOS,
  type HoldemSandboxScenarioId,
} from "./scenarios";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LOW: Rate = {
  id: "low",
  label: "LOW",
  buyInMin: 100,
  buyInMax: 500,
  betMin: 1,
  betMax: 5,
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
});

function renderHoldemScenario(
  scenarioId: HoldemSandboxScenarioId,
  options: { animationEnabled?: boolean } = {},
) {
  const scenario = findHoldemSandboxScenario(scenarioId);
  const economy = makeEconomy();
  let current: UseTexasHoldemReturn | null = null;
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);

  function Harness() {
    current = useTexasHoldem({
      rate: LOW,
      economy,
      deckProvider: () => scenario.deck,
      animationEnabled: options.animationEnabled ?? false,
      rng: () => 0,
    });
    return null;
  }

  act(() => root.render(<Harness />));

  return {
    economy,
    get current() {
      if (!current) throw new Error("useTexasHoldem did not render");
      return current;
    },
  };
}

function playerContinue(h: ReturnType<typeof renderHoldemScenario>) {
  return h.current.amountToCall > 0 ? h.current.call() : h.current.check();
}

function ackAll(h: ReturnType<typeof renderHoldemScenario>) {
  for (let i = 0; i < 250 && h.current.animationEvents.length > 0; i++) {
    const event = h.current.animationEvents[0]!;
    act(() => {
      h.current.onAnimationEventComplete(event.id);
    });
  }
}

function driveHeadlessToResult(
  h: ReturnType<typeof renderHoldemScenario>,
  playerAction: (h: ReturnType<typeof renderHoldemScenario>) => void,
) {
  for (let i = 0; i < 250; i++) {
    if (h.current.phase === "result") return;
    if (h.current.animationEvents.length > 0) {
      ackAll(h);
      continue;
    }
    if (
      (h.current.phase === "preflop" || h.current.phase === "flop" || h.current.phase === "turn" || h.current.phase === "river") &&
      h.current.currentTurnSeatIndex === h.current.playerSeatIndex
    ) {
      playerAction(h);
      continue;
    }
    act(() => {});
  }
  throw new Error("Timed out before result");
}

describe("Texas Holdem sandbox acceptance", () => {
  it("defines valid full fixed decks for every sandbox scenario", () => {
    expect(HOLDEM_SANDBOX_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "showdown-player-win",
      "fold-win",
      "split-pot",
      "all-in-auto-reveal",
      "available-actions",
      "animation-events",
    ]);

    for (const scenario of HOLDEM_SANDBOX_SCENARIOS) {
      expect(validatePokerDeck(scenario.deck, 52)).toMatchObject({ ok: true });
    }
  });

  it("runs buyIn to result through preflop, flop, turn, river, and showdown headlessly", () => {
    const h = renderHoldemScenario("showdown-player-win");

    act(() => {
      expect(h.current.buyIn(100)).toEqual({ ok: true });
    });
    expect(h.current.phase).toBe("waitingHand");

    act(() => {
      expect(h.current.startHand()).toEqual({ ok: true });
    });
    expect(h.current.phase).toBe("preflop");

    act(() => {
      expect(h.current.call()).toEqual({ ok: true });
    });
    expect(h.current.phase).toBe("flop");

    act(() => {
      expect(playerContinue(h)).toEqual({ ok: true });
    });
    expect(h.current.phase).toBe("turn");

    act(() => {
      expect(playerContinue(h)).toEqual({ ok: true });
    });
    expect(h.current.phase).toBe("river");

    act(() => {
      expect(playerContinue(h)).toEqual({ ok: true });
    });

    expect(h.current.phase).toBe("result");
    expect(h.current.lastResult?.reason).toBe("showdown");
    expect(h.current.lastResult?.winners.map((winner) => winner.seatIndex)).toEqual([0]);
    expect(h.current.communityCards).toHaveLength(5);
  });

  it("runs the fold victory sandbox scenario without showdown hands", () => {
    const h = renderHoldemScenario("fold-win");

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });
    act(() => {
      expect(h.current.raiseTo(4)).toEqual({ ok: true });
    });

    expect(h.current.phase).toBe("result");
    expect(h.current.lastResult?.reason).toBe("fold");
    expect(h.current.lastResult?.showdownHands).toEqual([]);
    expect(h.current.lastResult?.winningCategory).toBe("fold");
    expect(h.current.lastResult?.winners).toEqual([
      expect.objectContaining({ seatIndex: 0 }),
    ]);
  });

  it("runs the split pot sandbox scenario to multi-winner showdown", () => {
    const h = renderHoldemScenario("split-pot");

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });
    driveHeadlessToResult(h, (hook) => {
      act(() => {
        expect(playerContinue(hook)).toEqual({ ok: true });
      });
    });

    expect(h.current.lastResult?.reason).toBe("showdown");
    expect(h.current.lastResult?.winningCategory).toBe("royal_flush");
    expect(h.current.lastResult?.winners.length).toBeGreaterThan(1);
    expect(h.current.lastResult?.winners.reduce((sum, winner) => sum + winner.wonAmount, 0))
      .toBe(h.current.lastResult?.totalPotAmount);
  });

  it("runs the all-in sandbox scenario with automatic community reveal", () => {
    const h = renderHoldemScenario("all-in-auto-reveal");

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });
    act(() => {
      expect(h.current.allIn()).toEqual({ ok: true });
    });

    expect(h.current.phase).toBe("result");
    expect(h.current.lastResult?.reason).toBe("showdown");
    expect(h.current.communityCards).toHaveLength(5);
    expect(h.current.currentTurnSeatIndex).toBeNull();
  });

  it("exposes the availableActions inspection state on the fixed deck", () => {
    const h = renderHoldemScenario("available-actions");

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });

    expect(h.current.phase).toBe("preflop");
    expect(h.current.currentTurnSeatIndex).toBe(h.current.playerSeatIndex);
    expect(h.current.availableActions.fold.enabled).toBe(true);
    expect(h.current.availableActions.call.enabled).toBe(true);
    expect(h.current.availableActions.raise.enabled).toBe(true);
    expect(h.current.availableActions.allIn.enabled).toBe(true);
    expect(h.current.availableActions.check).toEqual({ enabled: false, reason: "INVALID_PHASE" });
    expect(h.current.availableActions.bet).toEqual({ enabled: false, reason: "INVALID_PHASE" });
  });

  it("emits the fixed blind and hole-card event queue for animation inspection", () => {
    const h = renderHoldemScenario("animation-events", { animationEnabled: true });

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });

    expect(h.current.phase).toBe("postingBlinds");
    expect(h.current.animationEvents.map((event) => event.type)).toEqual([
      "POST_BLIND",
      "POST_BLIND",
      "DEAL_HOLE",
      "DEAL_HOLE",
      "DEAL_HOLE",
      "DEAL_HOLE",
      "DEAL_HOLE",
      "DEAL_HOLE",
      "DEAL_HOLE",
      "DEAL_HOLE",
      "DEAL_HOLE",
      "DEAL_HOLE",
    ]);

    ackAll(h);
    expect(h.current.phase).toBe("preflop");
  });
});
