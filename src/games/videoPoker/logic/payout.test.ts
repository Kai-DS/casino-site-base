import { describe, it, expect } from "vitest";
import type { Card, Suit, Rank } from "@/types/card";
import { cardId } from "@/types/card";
import { evaluatePayout, getWinningCardIndexes, type CoinCount } from "./payout";

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), suit, rank });
const S = "spades",
  H = "hearts",
  D = "diamonds",
  C = "clubs";

const royal = [c(10, S), c(11, S), c(12, S), c(13, S), c(14, S)];
const flush = [c(2, D), c(5, D), c(9, D), c(11, D), c(13, D)];
const fullHouse = [c(9, H), c(9, S), c(9, D), c(13, C), c(13, H)];
const jacks = [c(11, H), c(11, S), c(3, D), c(4, C), c(9, H)];
const lowPair = [c(10, H), c(10, S), c(13, D), c(4, C), c(3, H)];
const noWin = [c(2, H), c(5, S), c(9, D), c(11, C), c(13, H)];

const evalAt = (cards: Card[], coinCount: CoinCount, betMin = 1, classicRoyalBonus = true) =>
  evaluatePayout({ cards, coinCount, betMin, classicRoyalBonus });

describe("evaluatePayout — 9/6 paytable", () => {
  it("full house 9, flush 6 (fullpay)", () => {
    expect(evalAt(fullHouse, 1).payout).toBe(9);
    expect(evalAt(flush, 1).payout).toBe(6);
  });

  it("scales linearly with coinCount", () => {
    expect(evalAt(flush, 3).payout).toBe(18); // 6 × 3
    const r = evalAt(flush, 3);
    expect(r.profit).toBe(18 - 3);
  });

  it("pays a pair of Jacks or better, flags isJacksOrBetter", () => {
    const r = evalAt(jacks, 2);
    expect(r.payout).toBe(2); // 1 × 2 coins
    expect(r.isJacksOrBetter).toBe(true);
    expect(r.category).toBe("one_pair");
  });

  it("does NOT pay a 10-or-lower pair (category none)", () => {
    const r = evalAt(lowPair, 5);
    expect(r.payout).toBe(0);
    expect(r.category).toBe("none");
    expect(r.isJacksOrBetter).toBe(false);
  });

  it("no win → payout 0, category none", () => {
    expect(evalAt(noWin, 5).category).toBe("none");
  });
});

describe("evaluatePayout — classic Royal MAX BET bonus", () => {
  it("Royal pays 250×bet below MAX BET", () => {
    expect(evalAt(royal, 1).payout).toBe(250);
    expect(evalAt(royal, 4).payout).toBe(1000);
  });

  it("Royal jumps to 4000 coins at MAX BET (flag on)", () => {
    const r = evalAt(royal, 5);
    expect(r.payout).toBe(4000);
    expect(r.isRoyalMaxBonus).toBe(true);
    expect(r.multiplier).toBe(800); // 4000 / 5
  });

  it("flag off → MAX BET Royal is just 250×5", () => {
    expect(evalAt(royal, 5, 1, false).payout).toBe(1250);
  });

  it("respects betMin (MIDDLE betMin=10, MAX BET)", () => {
    expect(evalAt(royal, 5, 10).payout).toBe(40_000); // 4000 × 10
  });
});

describe("getWinningCardIndexes (spec §30)", () => {
  it("royal / flush / full house → all 5", () => {
    expect(getWinningCardIndexes(royal, evalAt(royal, 5))).toEqual([0, 1, 2, 3, 4]);
    expect(getWinningCardIndexes(fullHouse, evalAt(fullHouse, 1))).toEqual([0, 1, 2, 3, 4]);
  });

  it("Jacks or Better → only the pair (2 cards)", () => {
    expect(getWinningCardIndexes(jacks, evalAt(jacks, 1))).toEqual([0, 1]);
  });

  it("two pair → 4 cards", () => {
    const twoPair = [c(9, H), c(9, S), c(13, D), c(13, C), c(3, H)];
    expect(getWinningCardIndexes(twoPair, evalAt(twoPair, 1))).toEqual([0, 1, 2, 3]);
  });

  it("no win / low pair → none", () => {
    expect(getWinningCardIndexes(lowPair, evalAt(lowPair, 1))).toEqual([]);
    expect(getWinningCardIndexes(noWin, evalAt(noWin, 1))).toEqual([]);
  });
});
