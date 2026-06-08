import { describe, it, expect } from "vitest";
import type { Card, Rank, Suit } from "@/types/card";
import { cardId } from "@/types/card";
import { evaluatePayout } from "./payout";
import { fastMultiplier, bestHold } from "./strategy";

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), suit, rank });
const S = "spades",
  H = "hearts",
  D = "diamonds",
  C = "clubs";

const SUIT_IDX: Record<Suit, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
const mult = (cards: Card[]) =>
  fastMultiplier(
    cards.map((x) => x.rank as number),
    cards.map((x) => SUIT_IDX[x.suit]),
    250,
  );

describe("fastMultiplier agrees with evaluatePayout (per-coin)", () => {
  const cases: Record<string, Card[]> = {
    royal: [c(10, S), c(11, S), c(12, S), c(13, S), c(14, S)],
    straightFlush: [c(9, H), c(10, H), c(11, H), c(12, H), c(13, H)],
    quads: [c(9, H), c(9, S), c(9, D), c(9, C), c(13, H)],
    fullHouse: [c(9, H), c(9, S), c(9, D), c(13, C), c(13, H)],
    flush: [c(2, D), c(5, D), c(9, D), c(11, D), c(13, D)],
    straight: [c(5, D), c(6, S), c(7, H), c(8, C), c(9, D)],
    wheel: [c(14, D), c(2, S), c(3, H), c(4, C), c(5, D)],
    trips: [c(9, H), c(9, S), c(9, D), c(2, C), c(13, H)],
    twoPair: [c(9, H), c(9, S), c(13, D), c(13, C), c(3, H)],
    jacks: [c(11, H), c(11, S), c(3, D), c(4, C), c(9, H)],
    lowPair: [c(10, H), c(10, S), c(3, D), c(4, C), c(9, H)],
    nothing: [c(2, H), c(5, S), c(9, D), c(11, C), c(13, H)],
  };

  for (const [name, cards] of Object.entries(cases)) {
    it(name, () => {
      const expected = evaluatePayout({ cards, coinCount: 1, betMin: 1, classicRoyalBonus: false }).payout;
      expect(mult(cards)).toBe(expected);
    });
  }
});

describe("bestHold — optimal strategy", () => {
  it("holds everything on a pat full house", () => {
    const hand = [c(9, S), c(9, H), c(9, D), c(13, S), c(13, H)];
    expect(bestHold(hand, 1, false).mask).toEqual([true, true, true, true, true]);
  }, 20000);

  it("holds the four to a royal flush, discarding the off-card", () => {
    const hand = [c(14, H), c(13, H), c(12, H), c(11, H), c(2, C)];
    expect(bestHold(hand, 1, false).mask).toEqual([true, true, true, true, false]);
  }, 20000);

  it("holds a made flush", () => {
    const hand = [c(2, H), c(5, H), c(9, H), c(11, H), c(13, H)];
    expect(bestHold(hand, 1, false).mask).toEqual([true, true, true, true, true]);
  }, 20000);

  it("keeps a high pair over a single high card", () => {
    const hand = [c(13, S), c(13, H), c(7, D), c(4, C), c(2, S)];
    expect(bestHold(hand, 1, false).mask).toEqual([true, true, false, false, false]);
  }, 20000);
});
