import type { Card } from "@/types/card";
import {
  bestHand,
  compareHandRank,
  type HandRank,
} from "@/games/shared/poker/handEvaluator";
import type { BestHoldemHand } from "../types";

function cardKey(card: Card): string {
  return `${card.suit}:${card.rank}`;
}

function assertUniqueCards(cards: readonly Card[]) {
  const seen = new Set<string>();
  for (const card of cards) {
    const key = cardKey(card);
    if (seen.has(key)) throw new Error(`Duplicate card: ${key}`);
    seen.add(key);
  }
}

export function rankBestOfSeven(
  holeCards: readonly [Card, Card],
  communityCards: readonly [Card, Card, Card, Card, Card],
): BestHoldemHand {
  const allCards = [...holeCards, ...communityCards];
  assertUniqueCards(allCards);

  const best = bestHand(holeCards, communityCards, "holdem");
  const usedHoleCardCount = best.cards.filter((card) =>
    holeCards.some((hole) => cardKey(hole) === cardKey(card)),
  ).length as 0 | 1 | 2;

  return {
    cards: best.cards,
    rank: best.rank,
    usedHoleCardCount,
  };
}

export function compareBestHoldemHands(a: BestHoldemHand, b: BestHoldemHand): number {
  return compareHandRank(a.rank, b.rank);
}

export type { HandRank };
