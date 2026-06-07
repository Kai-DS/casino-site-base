import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "@/types/card";
import { cardId } from "@/types/card";
import { validateVideoPokerDeck, VIDEO_POKER_MIN_DECK_SIZE } from "./deckProvider";

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), suit, rank });

const validDeck = (): Card[] => [
  c(2, "hearts"),
  c(3, "hearts"),
  c(4, "hearts"),
  c(5, "hearts"),
  c(6, "hearts"),
  c(7, "spades"),
  c(8, "spades"),
  c(9, "spades"),
  c(10, "spades"),
  c(11, "spades"),
];

describe("validateVideoPokerDeck", () => {
  it("accepts a unique fixed deck with enough cards", () => {
    const result = validateVideoPokerDeck(validDeck());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.deck).toHaveLength(VIDEO_POKER_MIN_DECK_SIZE);
  });

  it("rejects a deck with fewer than 10 cards", () => {
    const result = validateVideoPokerDeck(validDeck().slice(0, 9));
    expect(result).toMatchObject({ ok: false, reason: "DECK_EXHAUSTED" });
  });

  it("rejects duplicate card ids", () => {
    const deck = validDeck();
    deck[9] = { ...deck[8]!, suit: "clubs", rank: 12 };
    const result = validateVideoPokerDeck(deck);
    expect(result).toMatchObject({ ok: false, reason: "DUPLICATE_CARD" });
  });

  it("rejects duplicate suit/rank faces even if ids differ", () => {
    const deck = validDeck();
    deck[9] = { id: "custom-id", suit: deck[8]!.suit, rank: deck[8]!.rank };
    const result = validateVideoPokerDeck(deck);
    expect(result).toMatchObject({ ok: false, reason: "DUPLICATE_CARD" });
  });
});
