import { describe, it, expect } from "vitest";
import type { Card, Suit, Rank } from "@/types/card";
import { bestHand, HAND_CATEGORY } from "./handEvaluator";

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit });
const S = "spade",
  H = "heart",
  D = "diamond",
  Cl = "club";

describe("bestHand — Hold'em (best 5 of 7)", () => {
  it("finds a flush across hole + community", () => {
    const hole = [c("2", S), c("7", S)];
    const community = [c("9", S), c("J", S), c("K", S), c("3", H), c("4", D)];
    const best = bestHand(hole, community, "holdem");
    expect(best.rank.category).toBe(HAND_CATEGORY.Flush);
  });

  it("finds the nut straight using both hole cards", () => {
    const hole = [c("6", H), c("7", D)];
    const community = [c("8", S), c("9", Cl), c("10", H), c("2", D), c("K", S)];
    const best = bestHand(hole, community, "holdem");
    expect(best.rank.category).toBe(HAND_CATEGORY.Straight);
    expect(best.rank.tiebreak[0]).toBe(10);
  });
});

describe("bestHand — Omaha (exactly 2 hole + 3 community)", () => {
  it("a 4-card 'flush' in hand is NOT a flush (must use exactly 2 hole)", () => {
    // Hole is all spades, but Omaha allows only 2 hole cards → at most 2 spades + 3 board.
    const hole = [c("A", S), c("K", S), c("Q", S), c("J", S)];
    const community = [c("2", H), c("5", H), c("9", D), c("3", Cl), c("7", D)];
    const best = bestHand(hole, community, "omaha");
    expect(best.rank.category).not.toBe(HAND_CATEGORY.Flush);
  });

  it("makes a flush only when the board supplies 3 of the suit", () => {
    const hole = [c("A", S), c("K", S), c("2", H), c("3", D)];
    const community = [c("5", S), c("9", S), c("J", S), c("4", H), c("7", D)];
    const best = bestHand(hole, community, "omaha");
    expect(best.rank.category).toBe(HAND_CATEGORY.Flush);
  });

  it("uses exactly two hole cards for a set → full house possible", () => {
    const hole = [c("9", H), c("9", S), c("4", D), c("2", Cl)];
    const community = [c("9", D), c("K", S), c("K", H), c("3", Cl), c("7", D)];
    const best = bestHand(hole, community, "omaha");
    // 9-9 (hole) + 9,K,K (board) → full house, nines over kings.
    expect(best.rank.category).toBe(HAND_CATEGORY.FullHouse);
    expect(best.rank.tiebreak[0]).toBe(9);
  });
});
