// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameEconomy, GameResultDraft } from "@/games/shared/economy";
import type { Card, Rank, Suit } from "@/types/card";
import { cardId } from "@/types/card";
import type { Rate } from "@/types/casino";
import { useTexasHoldem, type UseTexasHoldemReturn } from "./useTexasHoldem";

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

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), rank, suit });

const fixedDeck = (): Card[] => [
  c(2, "clubs"),
  c(3, "clubs"),
  c(4, "clubs"),
  c(5, "clubs"),
  c(6, "clubs"),
  c(7, "clubs"),
  c(8, "clubs"),
  c(9, "clubs"),
  c(10, "clubs"),
  c(11, "clubs"),
  c(12, "clubs"),
  c(13, "clubs"),
  c(14, "clubs"),
  c(2, "hearts"),
  c(3, "hearts"),
];

const weakCpuDeck = (): Card[] => [
  c(2, "clubs"),
  c(3, "diamonds"),
  c(4, "clubs"),
  c(5, "diamonds"),
  c(14, "clubs"),
  c(7, "hearts"),
  c(8, "spades"),
  c(9, "hearts"),
  c(10, "spades"),
  c(14, "hearts"),
  c(12, "clubs"),
  c(13, "clubs"),
  c(14, "spades"),
  c(2, "hearts"),
  c(3, "hearts"),
];

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

function renderHoldem({
  deck = fixedDeck,
  economy = makeEconomy(),
  animationEnabled = false,
  rate = LOW,
}: {
  deck?: () => Card[];
  economy?: TestEconomy;
  animationEnabled?: boolean;
  rate?: Rate;
} = {}) {
  let current: UseTexasHoldemReturn | null = null;
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);

  function Harness() {
    current = useTexasHoldem({
      rate,
      economy,
      deckProvider: deck,
      animationEnabled,
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

function ackHeadEvent(h: ReturnType<typeof renderHoldem>) {
  const event = h.current.animationEvents[0];
  if (!event) throw new Error("No animation event to acknowledge");
  act(() => {
    h.current.onAnimationEventComplete(event.id);
  });
}

function driveUntil(h: ReturnType<typeof renderHoldem>, done: () => boolean, label: string) {
  for (let i = 0; i < 250; i++) {
    if (done()) return;
    if (h.current.animationEvents.length > 0) {
      ackHeadEvent(h);
      continue;
    }
    act(() => {});
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function driveToPlayerTurn(h: ReturnType<typeof renderHoldem>, phase: UseTexasHoldemReturn["phase"]) {
  driveUntil(
    h,
    () => h.current.phase === phase && h.current.currentTurnSeatIndex === h.current.playerSeatIndex && h.current.animationEvents.length === 0,
    `${phase} player turn`,
  );
}

describe("useTexasHoldem Phase 1/2", () => {
  it("starts in buyIn and seats the player without moving wallet chips", () => {
    const h = renderHoldem();

    expect(h.current.phase).toBe("buyIn");
    act(() => {
      expect(h.current.buyIn(100)).toEqual({ ok: true });
    });

    expect(h.current.phase).toBe("waitingHand");
    expect(h.current.tableStack).toBe(100);
    expect(h.economy.chips).toBe(1_000);
    expect(h.current.seats).toHaveLength(5);
  });

  it("starts a hand, posts SB/BB through stack updates, auto-connects CPU calls, and deals in fixed order", () => {
    const h = renderHoldem();

    act(() => {
      h.current.buyIn(100);
      expect(h.current.startHand()).toEqual({ ok: true });
    });

    expect(h.current.phase).toBe("preflop");
    expect(h.current.dealerButtonIndex).toBe(0);
    expect(h.current.smallBlindIndex).toBe(1);
    expect(h.current.bigBlindIndex).toBe(2);
    expect(h.current.pot.amount).toBe(7);
    expect(h.current.currentBet).toBe(2);
    expect(h.current.currentTurnSeatIndex).toBe(0);
    expect(h.current.amountToCall).toBe(2);
    expect(h.current.animationEvents).toHaveLength(0);
    expect(h.current.isAnimating).toBe(false);
    expect(h.current.seats[1]?.tableStack).toBe(99);
    expect(h.current.seats[2]?.tableStack).toBe(98);
    expect(h.current.seats[0]?.holeCards.map((card) => card.id)).toEqual([
      c(6, "clubs").id,
      c(11, "clubs").id,
    ]);
    expect(h.economy.placeBet).not.toHaveBeenCalled();
  });

  it("emits blind/deal events, then waits on CPU_THINKING before CPU action", () => {
    const h = renderHoldem({ animationEnabled: true });

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });

    expect(h.current.phase).toBe("postingBlinds");
    expect(h.current.isAnimating).toBe(true);
    expect(h.current.animationEvents.map((event) => event.type).slice(0, 2)).toEqual(["POST_BLIND", "POST_BLIND"]);
    const initialLength = h.current.animationEvents.length;
    const first = h.current.animationEvents[0]!;

    act(() => {
      h.current.onAnimationEventComplete(first.id);
    });

    expect(h.current.animationEvents).toHaveLength(initialLength - 1);
    expect(h.current.phase).toBe("postingBlinds");
    expect(h.current.isAnimating).toBe(true);

    act(() => {
      for (const event of [...h.current.animationEvents]) {
        h.current.onAnimationEventComplete(event.id);
      }
    });

    expect(h.current.phase).toBe("preflop");
    expect(h.current.isAnimating).toBe(true);
    expect(h.current.animationEvents).toHaveLength(1);
    expect(h.current.animationEvents[0]?.type).toBe("CPU_THINKING");

    act(() => {
      h.current.onAnimationEventComplete(h.current.animationEvents[0]!.id);
    });

    expect(h.current.animationEvents.map((event) => event.type)).toEqual(["PLAYER_ACTION_LABEL", "CHIP_TO_POT"]);
    expect(h.current.phase).toBe("preflop");
  });

  it("advances through flop, turn, river, showdown, and result with animation disabled", () => {
    const h = renderHoldem();

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });

    expect(h.current.phase).toBe("preflop");
    expect(h.current.currentTurnSeatIndex).toBe(0);

    act(() => {
      expect(h.current.call()).toEqual({ ok: true });
    });
    expect(h.current.phase).toBe("flop");
    expect(h.current.communityCards).toHaveLength(3);
    expect(h.current.currentBet).toBe(0);
    expect(h.current.currentTurnSeatIndex).toBe(0);

    act(() => {
      expect(h.current.check()).toEqual({ ok: true });
    });
    expect(h.current.phase).toBe("turn");
    expect(h.current.communityCards).toHaveLength(4);
    expect(h.current.currentTurnSeatIndex).toBe(0);

    act(() => {
      expect(h.current.check()).toEqual({ ok: true });
    });
    expect(h.current.phase).toBe("river");
    expect(h.current.communityCards).toHaveLength(5);
    expect(h.current.currentTurnSeatIndex).toBe(0);

    act(() => {
      expect(h.current.check()).toEqual({ ok: true });
    });
    expect(h.current.phase).toBe("result");
    expect(h.current.pot.amount).toBe(0);
    expect(h.current.lastResult?.reason).toBe("showdown");
    expect(h.current.lastResult?.winners.map((winner) => winner.seatIndex)).toEqual([0]);
    expect(h.current.tableStack).toBe(108);
    expect(h.economy.chips).toBe(1_008);
  });

  it("waits for showdown/result animation acknowledgements before entering result", () => {
    const h = renderHoldem({ animationEnabled: true });

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });
    driveToPlayerTurn(h, "preflop");

    act(() => {
      expect(h.current.call()).toEqual({ ok: true });
    });
    driveToPlayerTurn(h, "flop");

    act(() => {
      expect(h.current.check()).toEqual({ ok: true });
    });
    driveToPlayerTurn(h, "turn");

    act(() => {
      expect(h.current.check()).toEqual({ ok: true });
    });
    driveToPlayerTurn(h, "river");

    act(() => {
      expect(h.current.check()).toEqual({ ok: true });
    });
    driveUntil(h, () => h.current.phase === "showdown" && h.current.animationEvents.length > 0, "showdown events");

    expect(h.current.phase).toBe("showdown");
    expect(h.current.animationEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(["FLIP_HOLE", "HIGHLIGHT_BEST", "AWARD_POT", "RESULT_BANNER"]),
    );
    const first = h.current.animationEvents[0]!;

    act(() => {
      h.current.onAnimationEventComplete(first.id);
    });
    expect(h.current.phase).toBe("showdown");
    expect(h.current.lastResult?.reason).toBe("showdown");

    driveUntil(h, () => h.current.phase === "result", "result after showdown animation");
    expect(h.current.animationEvents).toHaveLength(0);
    expect(h.current.lastResult?.reason).toBe("showdown");
    expect(h.current.lastResult?.showdownHands.length).toBeGreaterThan(0);
  });

  it("settles immediately with a fold result when CPU folds leave only the player", () => {
    const h = renderHoldem({ deck: weakCpuDeck });

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });
    expect(h.current.phase).toBe("preflop");
    expect(h.current.currentTurnSeatIndex).toBe(0);

    act(() => {
      expect(h.current.raiseTo(4)).toEqual({ ok: true });
    });

    expect(h.current.phase).toBe("result");
    expect(h.current.lastResult?.reason).toBe("fold");
    expect(h.current.lastResult?.showdownHands).toEqual([]);
    expect(h.current.lastResult?.winningCategory).toBe("fold");
    expect(h.current.lastResult?.winners).toEqual([
      expect.objectContaining({ seatIndex: 0, wonAmount: 7 }),
    ]);
    expect(h.current.lastResult?.totalPotAmount).toBe(7);
    expect(h.current.tableStack).toBe(103);
    expect(h.economy.chips).toBe(1_003);
    expect(h.current.seats.find((seat) => seat.seatIndex === 1)?.tableStack).toBe(99);
    expect(h.current.seats.find((seat) => seat.seatIndex === 2)?.tableStack).toBe(98);
  });

  it("auto-reveals remaining community cards and resolves showdown when everyone is all-in", () => {
    const h = renderHoldem();

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });
    expect(h.current.phase).toBe("preflop");
    expect(h.current.currentTurnSeatIndex).toBe(0);

    act(() => {
      expect(h.current.allIn()).toEqual({ ok: true });
    });

    expect(h.current.phase).toBe("result");
    expect(h.current.currentTurnSeatIndex).toBeNull();
    expect(h.current.communityCards).toHaveLength(5);
    expect(h.current.lastResult?.reason).toBe("showdown");
    expect(h.current.lastResult?.showdownHands).toHaveLength(5);
  });

  it("rejects below-minimum raises with INVALID_BET", () => {
    const h = renderHoldem();

    act(() => {
      h.current.buyIn(100);
      h.current.startHand();
    });

    expect(h.current.raiseTo(3)).toMatchObject({ ok: false, reason: "INVALID_BET" });
  });
});
