import { describe, it, expect } from "vitest";
import type { Card, Suit, Rank } from "@/types/card";
import { rankFiveCardHand } from "@/games/shared/poker/handEvaluator";
import { videoPokerPayout, buildVideoPokerResult } from "./adapter";
import { RATE_BY_ID } from "@/constants/rates";

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit });
const S = "spade",
  H = "heart",
  D = "diamond",
  Cl = "club";

const royal = rankFiveCardHand([c("10", S), c("J", S), c("Q", S), c("K", S), c("A", S)]);
const flush = rankFiveCardHand([c("2", D), c("5", D), c("9", D), c("J", D), c("K", D)]);
const lowPair = rankFiveCardHand([c("3", H), c("3", S), c("K", D), c("8", Cl), c("2", H)]);

describe("videoPokerPayout — bet scaling", () => {
  const low = RATE_BY_ID.low; // betMin 1, betMax 5

  it("scales linearly with bet for normal hands", () => {
    expect(videoPokerPayout(flush, low, 1)).toBe(6); // 6 × 1 coin
    expect(videoPokerPayout(flush, low, 3)).toBe(18); // 6 × 3 coins
  });

  it("low pair pays nothing at any bet", () => {
    expect(videoPokerPayout(lowPair, low, 5)).toBe(0);
  });
});

describe("videoPokerPayout — classic Royal MAX BET bonus", () => {
  const low = RATE_BY_ID.low; // betMin 1, betMax 5
  const mid = RATE_BY_ID.middle; // betMin 10, betMax 50

  it("Royal pays 250×bet below MAX BET", () => {
    expect(videoPokerPayout(royal, low, 1)).toBe(250);
    expect(videoPokerPayout(royal, low, 4)).toBe(1000); // 250 × 4
  });

  it("Royal jumps to 4000 coins at MAX BET (not 250×5)", () => {
    expect(videoPokerPayout(royal, low, 5)).toBe(4000); // not 1250
  });

  it("the bonus respects the rate's coin value (MIDDLE)", () => {
    expect(videoPokerPayout(royal, mid, 50)).toBe(4000 * mid.betMin); // 40,000
    expect(videoPokerPayout(royal, mid, 40)).toBe(250 * 40); // below max → linear
  });

  it("buildVideoPokerResult reports bet/payout/profit", () => {
    const r = buildVideoPokerResult(flush, low, 2);
    expect(r).toMatchObject({ gameId: "videoPoker", bet: 2, payout: 12, profit: 10 });
  });
});
