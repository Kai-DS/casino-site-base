import { describe, it, expect } from "vitest";
import type { Card, Suit, Rank } from "@/types/card";
import { cardId } from "@/types/card";
import { bestHand } from "./handEvaluator";

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), suit, rank });
const S = "spades",
  H = "hearts",
  D = "diamonds",
  C = "clubs";

describe("bestHand — Hold'em (best 5 of 7)", () => {
  it("finds a flush across hole + community", () => {
    const hole = [c(2, S), c(7, S)];
    const community = [c(9, S), c(11, S), c(13, S), c(3, H), c(4, D)];
    expect(bestHand(hole, community, "holdem").rank.category).toBe("flush");
  });

  it("finds the nut straight using both hole cards", () => {
    const hole = [c(6, H), c(7, D)];
    const community = [c(8, S), c(9, C), c(10, H), c(2, D), c(13, S)];
    const best = bestHand(hole, community, "holdem");
    expect(best.rank.category).toBe("straight");
    expect(best.rank.tiebreak[0]).toBe(10);
  });
});

describe("bestHand — Omaha (exactly 2 hole + 3 community)", () => {
  it("a 4-card spade hole is NOT a flush (must use exactly 2 hole)", () => {
    const hole = [c(14, S), c(13, S), c(12, S), c(11, S)];
    const community = [c(2, H), c(5, H), c(9, D), c(3, C), c(7, D)];
    expect(bestHand(hole, community, "omaha").rank.category).not.toBe("flush");
  });

  it("makes a flush only when the board supplies 3 of the suit", () => {
    const hole = [c(14, S), c(13, S), c(2, H), c(3, D)];
    const community = [c(5, S), c(9, S), c(11, S), c(4, H), c(7, D)];
    expect(bestHand(hole, community, "omaha").rank.category).toBe("flush");
  });

  it("uses exactly two hole cards for a set → full house", () => {
    const hole = [c(9, H), c(9, S), c(4, D), c(2, C)];
    const community = [c(9, D), c(13, S), c(13, H), c(3, C), c(7, D)];
    const best = bestHand(hole, community, "omaha");
    expect(best.rank.category).toBe("full_house");
    expect(best.rank.tiebreak[0]).toBe(9);
  });
});
