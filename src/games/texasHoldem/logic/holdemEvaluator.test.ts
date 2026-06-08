import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "@/types/card";
import { cardId } from "@/types/card";
import { rankBestOfSeven } from "./holdemEvaluator";

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), rank, suit });

describe("rankBestOfSeven", () => {
  it("selects the best five cards from seven and detects 0 used hole cards", () => {
    const result = rankBestOfSeven(
      [c(2, "clubs"), c(3, "diamonds")],
      [c(10, "spades"), c(11, "spades"), c(12, "spades"), c(13, "spades"), c(14, "spades")],
    );

    expect(result.rank.category).toBe("royal_flush");
    expect(result.usedHoleCardCount).toBe(0);
  });

  it("reports one used hole card when the board needs one player card", () => {
    const result = rankBestOfSeven(
      [c(14, "spades"), c(2, "diamonds")],
      [c(10, "spades"), c(11, "spades"), c(12, "spades"), c(13, "spades"), c(5, "hearts")],
    );

    expect(result.rank.category).toBe("royal_flush");
    expect(result.usedHoleCardCount).toBe(1);
  });

  it("reports two used hole cards when both player cards are in the best hand", () => {
    const result = rankBestOfSeven(
      [c(14, "spades"), c(13, "spades")],
      [c(10, "spades"), c(11, "spades"), c(12, "spades"), c(2, "hearts"), c(3, "clubs")],
    );

    expect(result.rank.category).toBe("royal_flush");
    expect(result.usedHoleCardCount).toBe(2);
  });

  it("rejects duplicate cards", () => {
    expect(() =>
      rankBestOfSeven(
        [c(14, "spades"), c(14, "spades")],
        [c(10, "spades"), c(11, "spades"), c(12, "spades"), c(13, "spades"), c(5, "hearts")],
      ),
    ).toThrow(/Duplicate card/);
  });
});
