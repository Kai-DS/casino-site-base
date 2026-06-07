// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Rate } from "@/types/casino";
import type { Card, Rank, Suit } from "@/types/card";
import { cardId } from "@/types/card";
import type { GameEconomy, GameResultDraft } from "@/games/shared/economy";
import { useVideoPoker, type UseVideoPoker } from "./useVideoPoker";

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

const TINY: Rate = {
  id: "low",
  label: "TINY",
  buyInMin: 1,
  buyInMax: 500,
  betMin: 2,
  betMax: 10,
  blurb: "test",
};

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), suit, rank });

const exchangeDeck = (): Card[] => [
  c(2, "hearts"),
  c(3, "hearts"),
  c(4, "hearts"),
  c(5, "hearts"),
  c(6, "hearts"),
  c(11, "spades"),
  c(12, "spades"),
  c(13, "spades"),
  c(14, "spades"),
  c(10, "spades"),
];

const royalDeck = (): Card[] => [
  c(10, "spades"),
  c(11, "spades"),
  c(12, "spades"),
  c(13, "spades"),
  c(14, "spades"),
  c(2, "hearts"),
  c(3, "hearts"),
  c(4, "hearts"),
  c(5, "hearts"),
  c(6, "hearts"),
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

function renderVideoPoker({
  rate = LOW,
  economy = makeEconomy(),
  initialTableStack = rate.buyInMin,
  deck = exchangeDeck(),
  onInsufficient = vi.fn(),
}: {
  rate?: Rate;
  economy?: TestEconomy;
  initialTableStack?: number;
  deck?: Card[];
  onInsufficient?: () => void;
} = {}) {
  let current: UseVideoPoker | null = null;
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);

  function Harness() {
    current = useVideoPoker(rate, economy, onInsufficient, {
      initialTableStack,
      deckProvider: () => deck,
    });
    return null;
  }

  act(() => root.render(<Harness />));

  return {
    economy,
    onInsufficient,
    get current() {
      if (!current) throw new Error("useVideoPoker did not render");
      return current;
    },
  };
}

describe("useVideoPoker actions", () => {
  it("deals the first five fixed cards and replaces non-held cards left-to-right", () => {
    const h = renderVideoPoker();

    act(() => {
      expect(h.current.deal()).toEqual({ ok: true });
    });
    expect(h.current.phase).toBe("draw");
    expect(h.current.hand.map((card) => card?.id)).toEqual(exchangeDeck().slice(0, 5).map((card) => card.id));

    act(() => {
      h.current.toggleHold(0);
      h.current.toggleHold(3);
      expect(h.current.draw()).toEqual({ ok: true });
    });

    expect(h.current.phase).toBe("result");
    expect(h.current.hand.map((card) => card?.id)).toEqual([
      c(2, "hearts").id,
      c(11, "spades").id,
      c(12, "spades").id,
      c(5, "hearts").id,
      c(13, "spades").id,
    ]);
  });

  it("keeps chips and hook-owned tableStack moving in lockstep, without buyInMax clamping wins", () => {
    const h = renderVideoPoker({ deck: royalDeck(), initialTableStack: 100 });

    act(() => {
      expect(h.current.setCoinCount(5)).toEqual({ ok: true });
      expect(h.current.deal()).toEqual({ ok: true });
    });
    expect(h.economy.chips).toBe(995);
    expect(h.current.tableStack).toBe(95);

    act(() => {
      for (let i = 0; i < 5; i++) h.current.toggleHold(i);
      expect(h.current.draw()).toEqual({ ok: true });
    });

    expect(h.current.lastResult?.payout).toBe(4_000);
    expect(h.economy.chips).toBe(4_995);
    expect(h.current.tableStack).toBe(4_095);
  });

  it("returns INVALID_PHASE when changing coins during draw", () => {
    const h = renderVideoPoker();

    act(() => {
      h.current.deal();
    });

    let result = h.current.setCoinCount(2);
    expect(result).toMatchObject({ ok: false, reason: "INVALID_PHASE" });
    expect(h.current.coinCount).toBe(1);
  });

  it("blocks currentBet when tableStack is low but allows lowering the coin count", () => {
    const h = renderVideoPoker({ rate: TINY, initialTableStack: 3 });

    act(() => {
      expect(h.current.setCoinCount(2)).toEqual({ ok: true });
    });
    expect(h.current.currentBet).toBe(4);

    let result = h.current.deal();
    expect(result).toMatchObject({ ok: false, reason: "INSUFFICIENT_TABLE_STACK" });
    expect(h.economy.placeBet).not.toHaveBeenCalled();

    act(() => {
      expect(h.current.setCoinCount(1)).toEqual({ ok: true });
      expect(h.current.deal()).toEqual({ ok: true });
    });
    expect(h.economy.placeBet).toHaveBeenCalledTimes(1);
    expect(h.current.tableStack).toBe(1);
  });

  it("uses REBUY as a SET operation and does not move wallet chips", () => {
    const h = renderVideoPoker({ initialTableStack: 100 });

    act(() => {
      expect(h.current.rebuy(250)).toEqual({ ok: true });
    });

    expect(h.current.tableStack).toBe(250);
    expect(h.economy.chips).toBe(1_000);
    expect(h.current.rebuy(600)).toMatchObject({ ok: false, reason: "INVALID_BET" });
  });
});

describe("useVideoPoker deckProvider guards", () => {
  it("rejects duplicate fixed decks before taking a bet", () => {
    const deck = exchangeDeck();
    deck[9] = { id: "different-id", suit: deck[8]!.suit, rank: deck[8]!.rank };
    const h = renderVideoPoker({ deck });

    const result = h.current.deal();

    expect(result).toMatchObject({ ok: false, reason: "DUPLICATE_CARD" });
    expect(h.economy.placeBet).not.toHaveBeenCalled();
    expect(h.current.phase).toBe("ready");
  });

  it("rejects exhausted fixed decks before taking a bet", () => {
    const h = renderVideoPoker({ deck: exchangeDeck().slice(0, 9) });

    const result = h.current.deal();

    expect(result).toMatchObject({ ok: false, reason: "DECK_EXHAUSTED" });
    expect(h.economy.placeBet).not.toHaveBeenCalled();
    expect(h.current.phase).toBe("ready");
  });
});

describe("useVideoPoker rapid-click guards", () => {
  it("prevents synchronous double DEAL from charging twice", () => {
    const h = renderVideoPoker();
    let first = h.current.deal();
    let second = h.current.deal();

    expect(first).toEqual({ ok: true });
    expect(second).toMatchObject({ ok: false, reason: "ANIMATING" });
    expect(h.economy.placeBet).toHaveBeenCalledTimes(1);
  });

  it("prevents synchronous double DRAW from settling twice", () => {
    const h = renderVideoPoker({ deck: royalDeck() });

    act(() => {
      h.current.deal();
      for (let i = 0; i < 5; i++) h.current.toggleHold(i);
    });

    let first = h.current.draw();
    let second = h.current.draw();

    expect(first).toEqual({ ok: true });
    expect(second).toMatchObject({ ok: false, reason: "ANIMATING" });
    expect(h.economy.settle).toHaveBeenCalledTimes(1);
  });
});
