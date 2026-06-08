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
  economy = makeEconomy(),
  animationEnabled = false,
}: {
  economy?: TestEconomy;
  animationEnabled?: boolean;
} = {}) {
  let current: UseTexasHoldemReturn | null = null;
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);

  function Harness() {
    current = useTexasHoldem({
      rate: LOW,
      economy,
      deckProvider: fixedDeck,
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

describe("useTexasHoldem Phase 1", () => {
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

  it("starts a hand, posts SB/BB through stack updates, and deals in fixed order", () => {
    const h = renderHoldem();

    act(() => {
      h.current.buyIn(100);
      expect(h.current.startHand()).toEqual({ ok: true });
    });

    expect(h.current.phase).toBe("preflop");
    expect(h.current.dealerButtonIndex).toBe(0);
    expect(h.current.smallBlindIndex).toBe(1);
    expect(h.current.bigBlindIndex).toBe(2);
    expect(h.current.pot.amount).toBe(3);
    expect(h.current.currentBet).toBe(2);
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

  it("emits blind and deal events, consumes the head event, and waits for the whole queue", () => {
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
    expect(h.current.isAnimating).toBe(false);
  });
});
