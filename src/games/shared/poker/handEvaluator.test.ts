import { describe, it, expect } from "vitest";
import type { Card, Suit, Rank } from "@/types/card";
import { cardId } from "@/types/card";
import { rankFiveCardHand, compareHandRank, combinations } from "./handEvaluator";

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), suit, rank });
const S = "spades",
  H = "hearts",
  D = "diamonds",
  C = "clubs";

describe("rankFiveCardHand — categories", () => {
  it("royal flush", () => {
    expect(rankFiveCardHand([c(10, S), c(11, S), c(12, S), c(13, S), c(14, S)]).category).toBe("royal_flush");
  });

  it("straight flush (king-high)", () => {
    const r = rankFiveCardHand([c(9, H), c(10, H), c(11, H), c(12, H), c(13, H)]);
    expect(r.category).toBe("straight_flush");
    expect(r.tiebreak[0]).toBe(13);
  });

  it("four of a kind", () => {
    expect(rankFiveCardHand([c(9, H), c(9, S), c(9, D), c(9, C), c(13, H)]).category).toBe("four_of_a_kind");
  });

  it("full house", () => {
    expect(rankFiveCardHand([c(9, H), c(9, S), c(9, D), c(13, C), c(13, H)]).category).toBe("full_house");
  });

  it("flush", () => {
    expect(rankFiveCardHand([c(2, D), c(5, D), c(9, D), c(11, D), c(13, D)]).category).toBe("flush");
  });

  it("straight (normal)", () => {
    const r = rankFiveCardHand([c(5, D), c(6, S), c(7, H), c(8, C), c(9, D)]);
    expect(r.category).toBe("straight");
    expect(r.tiebreak[0]).toBe(9);
  });

  it("wheel A-2-3-4-5 is a five-high straight", () => {
    const r = rankFiveCardHand([c(14, D), c(2, S), c(3, H), c(4, C), c(5, D)]);
    expect(r.category).toBe("straight");
    expect(r.tiebreak[0]).toBe(5);
  });

  it("A-K-Q-J-10 is an ace-high straight (not wheel)", () => {
    expect(rankFiveCardHand([c(14, D), c(13, S), c(12, H), c(11, C), c(10, D)]).tiebreak[0]).toBe(14);
  });

  it("three of a kind", () => {
    expect(rankFiveCardHand([c(9, H), c(9, S), c(9, D), c(2, C), c(13, H)]).category).toBe("three_of_a_kind");
  });

  it("two pair", () => {
    expect(rankFiveCardHand([c(9, H), c(9, S), c(13, D), c(13, C), c(3, H)]).category).toBe("two_pair");
  });

  it("one pair", () => {
    const r = rankFiveCardHand([c(9, H), c(9, S), c(13, D), c(4, C), c(3, H)]);
    expect(r.category).toBe("one_pair");
    expect(r.tiebreak[0]).toBe(9); // pair rank first (payout relies on this)
  });

  it("high card", () => {
    expect(rankFiveCardHand([c(2, H), c(5, S), c(9, D), c(11, C), c(13, H)]).category).toBe("high_card");
  });

  it("throws on wrong card count", () => {
    expect(() => rankFiveCardHand([c(2, H)])).toThrow();
  });
});

describe("compareHandRank", () => {
  it("higher category wins", () => {
    const flush = rankFiveCardHand([c(2, D), c(5, D), c(9, D), c(11, D), c(13, D)]);
    const straight = rankFiveCardHand([c(5, D), c(6, S), c(7, H), c(8, C), c(9, D)]);
    expect(compareHandRank(flush, straight)).toBeGreaterThan(0);
  });

  it("same category breaks by tiebreak (aces over kings)", () => {
    const aces = rankFiveCardHand([c(14, H), c(14, S), c(13, D), c(4, C), c(3, H)]);
    const kings = rankFiveCardHand([c(13, H), c(13, S), c(12, D), c(4, C), c(3, H)]);
    expect(compareHandRank(aces, kings)).toBeGreaterThan(0);
  });

  it("identical strength compares equal", () => {
    const a = rankFiveCardHand([c(14, H), c(14, S), c(13, D), c(4, C), c(3, H)]);
    const b = rankFiveCardHand([c(14, D), c(14, C), c(13, S), c(4, H), c(3, S)]);
    expect(compareHandRank(a, b)).toBe(0);
  });
});

describe("combinations", () => {
  it("C(7,5)=21 and C(5,3)=10", () => {
    expect(combinations([1, 2, 3, 4, 5, 6, 7], 5)).toHaveLength(21);
    expect(combinations([1, 2, 3, 4, 5], 3)).toHaveLength(10);
  });
});
