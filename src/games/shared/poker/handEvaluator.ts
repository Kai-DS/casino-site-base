// games/shared/poker/handEvaluator.ts — pure 5-card ranking shared across all poker games.
// Video Poker uses rankFiveCardHand; Hold'em/Omaha will reuse it via bestHand (spec §9.4).
import type { Card } from "@/types/card";
import { RANK_VALUE } from "@/types/card";

export const HAND_CATEGORY = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
  RoyalFlush: 9,
} as const;

export type HandCategory = (typeof HAND_CATEGORY)[keyof typeof HAND_CATEGORY];

export const HAND_CATEGORY_NAME: Record<HandCategory, string> = {
  [HAND_CATEGORY.HighCard]: "High Card",
  [HAND_CATEGORY.Pair]: "Pair",
  [HAND_CATEGORY.TwoPair]: "Two Pair",
  [HAND_CATEGORY.ThreeOfAKind]: "Three of a Kind",
  [HAND_CATEGORY.Straight]: "Straight",
  [HAND_CATEGORY.Flush]: "Flush",
  [HAND_CATEGORY.FullHouse]: "Full House",
  [HAND_CATEGORY.FourOfAKind]: "Four of a Kind",
  [HAND_CATEGORY.StraightFlush]: "Straight Flush",
  [HAND_CATEGORY.RoyalFlush]: "Royal Flush",
};

export type HandRank = {
  category: HandCategory;
  name: string;
  /** Descending tiebreak values; compared lexicographically within a category. */
  tiebreak: number[];
};

/** Rank exactly five cards. Throws if not given 5. */
export function rankFiveCardHand(cards: readonly Card[]): HandRank {
  if (cards.length !== 5) {
    throw new Error(`rankFiveCardHand expects 5 cards, got ${cards.length}`);
  }

  const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0]!.suit);

  // Group by value: [{ value, count }], sorted by count desc then value desc.
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  // Straight detection (5 distinct, consecutive) incl. the wheel A-2-3-4-5.
  const uniqAsc = [...counts.keys()].sort((a, b) => a - b);
  let isStraight = false;
  let straightHigh = 0;
  if (uniqAsc.length === 5) {
    if (uniqAsc[4]! - uniqAsc[0]! === 4) {
      isStraight = true;
      straightHigh = uniqAsc[4]!;
    } else if (uniqAsc[0] === 2 && uniqAsc[1] === 3 && uniqAsc[2] === 4 && uniqAsc[3] === 5 && uniqAsc[4] === 14) {
      isStraight = true;
      straightHigh = 5; // wheel: ace plays low
    }
  }

  const make = (category: HandCategory, tiebreak: number[]): HandRank => ({
    category,
    name: HAND_CATEGORY_NAME[category],
    tiebreak,
  });

  const counted = groups.map((g) => g.value); // values ordered by group strength

  if (isStraight && isFlush) {
    return straightHigh === 14
      ? make(HAND_CATEGORY.RoyalFlush, [14])
      : make(HAND_CATEGORY.StraightFlush, [straightHigh]);
  }
  if (groups[0]!.count === 4) return make(HAND_CATEGORY.FourOfAKind, counted);
  if (groups[0]!.count === 3 && groups[1]?.count === 2) return make(HAND_CATEGORY.FullHouse, counted);
  if (isFlush) return make(HAND_CATEGORY.Flush, values);
  if (isStraight) return make(HAND_CATEGORY.Straight, [straightHigh]);
  if (groups[0]!.count === 3) return make(HAND_CATEGORY.ThreeOfAKind, counted);
  if (groups[0]!.count === 2 && groups[1]?.count === 2) return make(HAND_CATEGORY.TwoPair, counted);
  if (groups[0]!.count === 2) return make(HAND_CATEGORY.Pair, counted);
  return make(HAND_CATEGORY.HighCard, values);
}

/** Positive if a beats b, negative if b beats a, 0 if identical strength. */
export function compareHandRank(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** All k-combinations of an array (indices preserved). */
export function combinations<T>(items: readonly T[], k: number): T[][] {
  const result: T[][] = [];
  const combo: T[] = [];
  const recurse = (start: number) => {
    if (combo.length === k) {
      result.push(combo.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]!);
      recurse(i + 1);
      combo.pop();
    }
  };
  recurse(0);
  return result;
}

export type BestHand = { rank: HandRank; cards: Card[] };

/**
 * Best 5-card hand.
 *  - holdem: best 5 of the 7 available (C(7,5)=21).
 *  - omaha:  exactly 2 hole + 3 community (C(4,2)×C(5,3)=60).
 * Only the combination generator differs; rankFiveCardHand is shared (spec §9.4).
 */
export function bestHand(
  hole: readonly Card[],
  community: readonly Card[],
  game: "holdem" | "omaha",
): BestHand {
  let best: BestHand | null = null;
  const consider = (five: Card[]) => {
    const rank = rankFiveCardHand(five);
    if (!best || compareHandRank(rank, best.rank) > 0) best = { rank, cards: five };
  };

  if (game === "holdem") {
    for (const five of combinations([...hole, ...community], 5)) consider(five);
  } else {
    for (const h2 of combinations(hole, 2)) {
      for (const c3 of combinations(community, 3)) consider([...h2, ...c3]);
    }
  }

  if (!best) throw new Error("bestHand: no combination evaluated");
  return best;
}
