// games/shared/poker/deck.ts — 52-card deck + dealing. Per SPEC_VIDEO_POKER_v1.2 §15.3.
import type { Card, Suit, Rank, RNG } from "@/types/card";
import { SUITS, RANKS, cardId } from "@/types/card";

export type { Card, Suit, Rank, RNG };

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
