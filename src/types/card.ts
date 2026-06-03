// types/card.ts — gameplay card types (poker family). See spec §10.
// NOTE: distinct from the lobby decoration CardSuit in types/game.ts (which includes "joker").
export type Suit = "spade" | "heart" | "diamond" | "club";

export type Rank =
  | "A"
  | "K"
  | "Q"
  | "J"
  | "10"
  | "9"
  | "8"
  | "7"
  | "6"
  | "5"
  | "4"
  | "3"
  | "2";

export type Card = { suit: Suit; rank: Rank };

export const SUITS: readonly Suit[] = ["spade", "heart", "diamond", "club"];

export const RANKS: readonly Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

// Numeric value for straight/high-card comparisons. Ace is high (14);
// the wheel (A-2-3-4-5) is handled explicitly in the hand evaluator.
export const RANK_VALUE: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};
