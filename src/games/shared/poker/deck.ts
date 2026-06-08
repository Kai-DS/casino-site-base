// games/shared/poker/deck.ts — 52-card deck + dealing. Per SPEC_VIDEO_POKER_v1.2 §15.3.
import type { Card, Suit, Rank, RNG } from "@/types/card";
import { SUITS, RANKS, cardId } from "@/types/card";

export type { Card, Suit, Rank, RNG };
export type DeckValidationError = "DECK_EXHAUSTED" | "DUPLICATE_CARD" | "INVALID_CARD";

const defaultRng: RNG = Math.random;

/** Fresh ordered 52-card deck (suit-major). */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: cardId(suit, rank), suit, rank });
    }
  }
  return deck;
}

/** Fisher–Yates shuffle returning a NEW array (input not mutated). */
export function shuffle(deck: readonly Card[], rng: RNG = defaultRng): Card[] {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Take `n` cards off the top; returns them and the remaining deck (immutable). */
export function take(deck: readonly Card[], n: number): { taken: Card[]; rest: Card[] } {
  return { taken: deck.slice(0, n), rest: deck.slice(n) };
}

/** Convenience: a freshly shuffled deck. */
export function shuffledDeck(rng: RNG = defaultRng): Card[] {
  return shuffle(createDeck(), rng);
}

export type DeckValidationResult =
  | { ok: true; deck: Card[] }
  | { ok: false; reason: DeckValidationError; message: string };

export function validatePokerDeck(deck: readonly Card[], minCards = 52): DeckValidationResult {
  if (deck.length < minCards) {
    return { ok: false, reason: "DECK_EXHAUSTED", message: "デッキの枚数が不足しています。" };
  }

  const validSuits = new Set<string>(SUITS);
  const validRanks = new Set<number>(RANKS);
  const seen = new Set<string>();

  for (const card of deck) {
    if (!validSuits.has(card.suit) || !validRanks.has(card.rank)) {
      return { ok: false, reason: "INVALID_CARD", message: "不正なカードが含まれています。" };
    }

    const key = `${card.suit}:${card.rank}`;
    if (seen.has(key)) {
      return { ok: false, reason: "DUPLICATE_CARD", message: "重複したカードが含まれています。" };
    }
    seen.add(key);
  }

  return { ok: true, deck: deck.slice() };
}
