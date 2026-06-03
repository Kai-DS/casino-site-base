// games/shared/poker/deck.ts — standard 52-card deck + dealing, shared by poker games.
import type { Card } from "@/types/card";
import { SUITS, RANKS } from "@/types/card";
import { shuffle as shuffleArr, type Rng, defaultRng } from "@/utils/random";

/** Fresh ordered 52-card deck. */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Shuffled 52-card deck (input deck not mutated). */
export function shuffledDeck(rng: Rng = defaultRng): Card[] {
  return shuffleArr(buildDeck(), rng);
}

/** Deal `n` cards off the top, returning them and the remaining deck (immutable). */
export function deal(deck: readonly Card[], n: number): { cards: Card[]; rest: Card[] } {
  return { cards: deck.slice(0, n), rest: deck.slice(n) };
}
