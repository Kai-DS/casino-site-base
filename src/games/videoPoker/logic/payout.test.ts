import { describe, it, expect } from "vitest";
import type { Card, Suit, Rank } from "@/types/card";
import { rankFiveCardHand } from "@/games/shared/poker/handEvaluator";
import { classifyVideoPoker } from "./payout";

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit });
const S = "spade",
  H = "heart",
  D = "diamond",
  Cl = "club";

const classify = (cards: Card[]) => classifyVideoPoker(rankFiveCardHand(cards));

describe("classifyVideoPoker — Jacks or Better 9/6", () => {
  it("royal flush pays 250", () => {
    expect(classify([c("10", S), c("J", S), c("Q", S), c("K", S), c("A", S)]).multiplier).toBe(250);
  });

  it("full house pays 9, flush pays 6, straight pays 4", () => {
    expect(classify([c("9", H), c("9", S), c("9", D), c("K", Cl), c("K", H)]).multiplier).toBe(9);
    expect(classify([c("2", D), c("5", D), c("9", D), c("J", D), c("K", D)]).multiplier).toBe(6);
    expect(classify([c("5", D), c("6", S), c("7", H), c("8", Cl), c("9", D)]).multiplier).toBe(4);
  });

  it("pays for a pair of Jacks or better", () => {
    expect(classify([c("J", H), c("J", S), c("3", D), c("4", Cl), c("9", H)]).multiplier).toBe(1);
    expect(classify([c("A", H), c("A", S), c("3", D), c("4", Cl), c("9", H)]).multiplier).toBe(1);
  });

  it("does NOT pay for a low pair", () => {
    expect(classify([c("10", H), c("10", S), c("3", D), c("4", Cl), c("9", H)]).multiplier).toBe(0);
    expect(classify([c("2", H), c("2", S), c("K", D), c("4", Cl), c("9", H)]).multiplier).toBe(0);
  });

  it("high card pays nothing", () => {
    expect(classify([c("2", H), c("5", S), c("9", D), c("J", Cl), c("K", H)]).multiplier).toBe(0);
  });
});
