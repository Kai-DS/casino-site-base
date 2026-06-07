// games/shared/poker/handEvaluator.ts — pure 5-card ranking shared by all poker games.
// Per SPEC_VIDEO_POKER_v1.2 §5 / 付録A. Video Poker's Jacks-or-Better check lives in payout.ts;
// this module only returns `one_pair` (Hold'em/Omaha reuse via bestHand).
import type { Card } from "@/types/card";

export type HandCategory =
  | "royal_flush"
  | "straight_flush"
  | "four_of_a_kind"
  | "full_house"
  | "flush"
  | "straight"
  | "three_of_a_kind"
  | "two_pair"
  | "one_pair"
  | "high_card";

export interface HandRank {
  category: HandCategory;
  // Kicker comparison: ranks that decide the hand, strongest first.
  // e.g. one_pair → tiebreak[0] = pair rank, then kickers descending.
  tiebreak: number[];
}

/** Strength order (higher = better). */
const CATEGORY_ORDER: Record<HandCategory, number> = {
  high_card: 0,
  one_pair: 1,
  two_pair: 2,
  three_of_a_kind: 3,
  straight: 4,
  flush: 5,
  full_house: 6,
  four_of_a_kind: 7,
  straight_flush: 8,
  royal_flush: 9,
};

export function categoryOrder(category: HandCategory): number {
  return CATEGORY_ORDER[category];
}

/** Rank exactly five cards. Throws if not given 5. */
export function rankFiveCardHand(cards: readonly Card[]): HandRank {
  if (cards.length !== 5) {
    throw new Error(`rankFiveCardHand expects 5 cards, got ${cards.length}`);
  }

  const values = cards.map((c) => c.rank).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0]!.suit);

  // Group by rank: [{ value, count }] sorted by count desc then value desc.
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const counted = groups.map((g) => g.value);

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

  const make = (category: HandCategory, tiebreak: number[]): HandRank => ({ category, tiebreak });

  if (isStraight && isFlush) {
    return straightHigh === 14
      ? make("royal_flush", [14])
      : make("straight_flush", [straightHigh]);
  }
  if (groups[0]!.count === 4) return make("four_of_a_kind", counted);
  if (groups[0]!.count === 3 && groups[1]?.count === 2) return make("full_house", counted);
  if (isFlush) return make("flush", values);
  if (isStraight) return make("straight", [straightHigh]);
  if (groups[0]!.count === 3) return make("three_of_a_kind", counted);
  if (groups[0]!.count === 2 && groups[1]?.count === 2) return make("two_pair", counted);
  if (groups[0]!.count === 2) return make("one_pair", counted);
  return make("high_card", values);
}

/** Positive if a beats b, negative if b beats a, 0 if identical strength. */
export function compareHandRank(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** All k-combinations of an array (order preserved). */
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
 *  - holdem: best 5 of 7 (C(7,5)=21).
 *  - omaha:  exactly 2 hole + 3 community (C(4,2)×C(5,3)=60).
 * Only the combination generator differs; rankFiveCardHand is shared (spec §5).
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
