// types/card.ts — gameplay card types (poker family). Per SPEC_VIDEO_POKER_v1.2 §15.3 / 付録A.
// Ranks are numeric (11=J, 12=Q, 13=K, 14=A); each Card carries a hand-unique `id`.
// NOTE: distinct from the lobby decoration CardSuit in types/game.ts (which includes "joker").
export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  readonly id: string; // e.g. "s-14" (spades, Ace). Unique within a hand.
  readonly suit: Suit;
  readonly rank: Rank;
}

export type RNG = () => number; // [0, 1)

export const SUITS: readonly Suit[] = ["spades", "hearts", "diamonds", "clubs"];

export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** suit initial used in Card.id ("spades" → "s"). */
export const SUIT_INITIAL: Record<Suit, string> = {
  spades: "s",
  hearts: "h",
  diamonds: "d",
  clubs: "c",
};

export const SUIT_GLYPH: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export const RED_SUITS: readonly Suit[] = ["hearts", "diamonds"];

/** Display label for a rank ("11" → "J", "14" → "A"). */
export const RANK_LABEL: Record<Rank, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

/** Stable id for a (suit, rank) pair. */
export function cardId(suit: Suit, rank: Rank): string {
  return `${SUIT_INITIAL[suit]}-${rank}`;
}
