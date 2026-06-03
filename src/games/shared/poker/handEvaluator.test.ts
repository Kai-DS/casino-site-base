import { describe, it, expect } from "vitest";
import type { Card, Suit, Rank } from "@/types/card";
import {
  rankFiveCardHand,
  compareHandRank,
  HAND_CATEGORY,
  combinations,
} from "./handEvaluator";

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit });
const S = "spade",
  H = "heart",
  D = "diamond",
  Cl = "club";

describe("rankFiveCardHand — categories", () => {
  it("royal flush", () => {
    const hand = [c("10", S), c("J", S), c("Q", S), c("K", S), c("A", S)];
    expect(rankFiveCardHand(hand).category).toBe(HAND_CATEGORY.RoyalFlush);
  });

  it("straight flush (king-high)", () => {
    const hand = [c("9", H), c("10", H), c("J", H), c("Q", H), c("K", H)];
    const r = rankFiveCardHand(hand);
    expect(r.category).toBe(HAND_CATEGORY.StraightFlush);
    expect(r.tiebreak[0]).toBe(13);
  });

  it("four of a kind", () => {
    const hand = [c("9", H), c("9", S), c("9", D), c("9", Cl), c("K", H)];
    expect(rankFiveCardHand(hand).category).toBe(HAND_CATEGORY.FourOfAKind);
  });

  it("full house", () => {
    const hand = [c("9", H), c("9", S), c("9", D), c("K", Cl), c("K", H)];
    expect(rankFiveCardHand(hand).category).toBe(HAND_CATEGORY.FullHouse);
  });

  it("flush", () => {
    const hand = [c("2", D), c("5", D), c("9", D), c("J", D), c("K", D)];
    expect(rankFiveCardHand(hand).category).toBe(HAND_CATEGORY.Flush);
  });

  it("straight (normal)", () => {
    const hand = [c("5", D), c("6", S), c("7", H), c("8", Cl), c("9", D)];
    const r = rankFiveCardHand(hand);
    expect(r.category).toBe(HAND_CATEGORY.Straight);
    expect(r.tiebreak[0]).toBe(9);
  });

  it("straight (wheel A-2-3-4-5, ace low → five-high)", () => {
    const hand = [c("A", D), c("2", S), c("3", H), c("4", Cl), c("5", D)];
    const r = rankFiveCardHand(hand);
    expect(r.category).toBe(HAND_CATEGORY.Straight);
    expect(r.tiebreak[0]).toBe(5);
  });

  it("A-K-Q-J-10 is a straight, not a wheel", () => {
    const hand = [c("A", D), c("K", S), c("Q", H), c("J", Cl), c("10", D)];
    expect(rankFiveCardHand(hand).tiebreak[0]).toBe(14);
  });

  it("three of a kind", () => {
    const hand = [c("9", H), c("9", S), c("9", D), c("2", Cl), c("K", H)];
    expect(rankFiveCardHand(hand).category).toBe(HAND_CATEGORY.ThreeOfAKind);
  });

  it("two pair", () => {
    const hand = [c("9", H), c("9", S), c("K", D), c("K", Cl), c("3", H)];
    expect(rankFiveCardHand(hand).category).toBe(HAND_CATEGORY.TwoPair);
  });

  it("one pair", () => {
    const hand = [c("9", H), c("9", S), c("K", D), c("4", Cl), c("3", H)];
    expect(rankFiveCardHand(hand).category).toBe(HAND_CATEGORY.Pair);
  });

  it("high card", () => {
    const hand = [c("2", H), c("5", S), c("9", D), c("J", Cl), c("K", H)];
    expect(rankFiveCardHand(hand).category).toBe(HAND_CATEGORY.HighCard);
  });

  it("throws on wrong card count", () => {
    expect(() => rankFiveCardHand([c("2", H)])).toThrow();
  });
});

describe("compareHandRank — ordering", () => {
  it("higher category wins", () => {
    const flush = rankFiveCardHand([c("2", D), c("5", D), c("9", D), c("J", D), c("K", D)]);
    const straight = rankFiveCardHand([c("5", D), c("6", S), c("7", H), c("8", Cl), c("9", D)]);
    expect(compareHandRank(flush, straight)).toBeGreaterThan(0);
  });

  it("same category breaks by tiebreak (higher pair wins)", () => {
    const aces = rankFiveCardHand([c("A", H), c("A", S), c("K", D), c("4", Cl), c("3", H)]);
    const kings = rankFiveCardHand([c("K", H), c("K", S), c("Q", D), c("4", Cl), c("3", H)]);
    expect(compareHandRank(aces, kings)).toBeGreaterThan(0);
  });

  it("identical strength compares equal", () => {
    const a = rankFiveCardHand([c("A", H), c("A", S), c("K", D), c("4", Cl), c("3", H)]);
    const b = rankFiveCardHand([c("A", D), c("A", Cl), c("K", S), c("4", H), c("3", S)]);
    expect(compareHandRank(a, b)).toBe(0);
  });
});

describe("combinations", () => {
  it("C(7,5) = 21 and C(5,3) = 10", () => {
    expect(combinations([1, 2, 3, 4, 5, 6, 7], 5)).toHaveLength(21);
    expect(combinations([1, 2, 3, 4, 5], 3)).toHaveLength(10);
  });
});
