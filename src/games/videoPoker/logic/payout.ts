// games/videoPoker/logic/payout.ts — Jacks or Better (9/6) payout. Per SPEC_VIDEO_POKER_v1.2 §8, §29, §30.
// Pure & Vitest-tested. Jacks-or-Better detection lives here (handEvaluator only returns one_pair).
import type { Card, Rank } from "@/types/card";
import { rankFiveCardHand, type HandCategory } from "@/games/shared/poker/handEvaluator";

export type CoinCount = 1 | 2 | 3 | 4 | 5;

/** Classic VP: Royal at MAX BET (5 coins) pays 4000 coins instead of 250×5. */
export const ROYAL_MAX_BET_COINS = 4000;
export const MAX_COINS = 5;

/** Base per-bet multipliers (9/6). */
const BASE_MULTIPLIER: Record<HandCategory, number> = {
  royal_flush: 250,
  straight_flush: 50,
  four_of_a_kind: 25,
  full_house: 9,
  flush: 6,
  straight: 4,
  three_of_a_kind: 3,
  two_pair: 2,
  one_pair: 1, // only pays as Jacks or Better (J+)
  high_card: 0,
};

export interface PayoutInput {
  cards: Card[]; // final 5
  coinCount: CoinCount;
  betMin: number; // rate.betMin
  classicRoyalBonus: boolean;
}

export interface PayoutResult {
  category: HandCategory | "none"; // payout category; 10-or-lower pair / no win → "none"
  multiplier: number; // effective payout/bet (e.g. 800 for RF max-bet bonus)
  payout: number;
  profit: number;
  isJacksOrBetter: boolean;
  isRoyalMaxBonus: boolean;
}

export function evaluatePayout(input: PayoutInput): PayoutResult {
  const { cards, coinCount, betMin, classicRoyalBonus } = input;
  const bet = betMin * coinCount;
  const rank = rankFiveCardHand(cards);

  let category: HandCategory | "none" = rank.category;
  let payout = 0;
  let isJacksOrBetter = false;
  let isRoyalMaxBonus = false;

  switch (rank.category) {
    case "royal_flush":
      if (classicRoyalBonus && coinCount === MAX_COINS) {
        payout = betMin * ROYAL_MAX_BET_COINS;
        isRoyalMaxBonus = true;
      } else {
        payout = BASE_MULTIPLIER.royal_flush * bet;
      }
      break;
    case "one_pair":
      if ((rank.tiebreak[0] ?? 0) >= 11) {
        payout = BASE_MULTIPLIER.one_pair * bet; // Jacks or Better
        isJacksOrBetter = true;
      } else {
        payout = 0;
        category = "none"; // 10-or-lower pair pays nothing
      }
      break;
    case "high_card":
      payout = 0;
      category = "none";
      break;
    default:
      payout = BASE_MULTIPLIER[rank.category] * bet;
  }

  return {
    category,
    multiplier: bet > 0 ? payout / bet : 0,
    payout,
    profit: payout - bet,
    isJacksOrBetter,
    isRoyalMaxBonus,
  };
}

// ── Display ──────────────────────────────────────────────────────────────────

export const PAYOUT_LABELS: Record<PayoutResult["category"], string> = {
  royal_flush: "ROYAL FLUSH",
  straight_flush: "STRAIGHT FLUSH",
  four_of_a_kind: "FOUR OF A KIND",
  full_house: "FULL HOUSE",
  flush: "FLUSH",
  straight: "STRAIGHT",
  three_of_a_kind: "THREE OF A KIND",
  two_pair: "TWO PAIR",
  one_pair: "JACKS OR BETTER",
  high_card: "NO WIN",
  none: "NO WIN",
};

export type PaytableRow = { category: HandCategory; label: string; multiplier: number };

/** Paytable rows, strongest first (for the on-screen coin grid). */
export const PAYTABLE: readonly PaytableRow[] = [
  { category: "royal_flush", label: "Royal Flush", multiplier: 250 },
  { category: "straight_flush", label: "Straight Flush", multiplier: 50 },
  { category: "four_of_a_kind", label: "Four of a Kind", multiplier: 25 },
  { category: "full_house", label: "Full House", multiplier: 9 },
  { category: "flush", label: "Flush", multiplier: 6 },
  { category: "straight", label: "Straight", multiplier: 4 },
  { category: "three_of_a_kind", label: "Three of a Kind", multiplier: 3 },
  { category: "two_pair", label: "Two Pair", multiplier: 2 },
  { category: "one_pair", label: "Jacks or Better", multiplier: 1 },
];

/** Coins paid for a paytable row at a given coin count (handles the RF max-bet jump). */
export function coinPayout(row: PaytableRow, coinCount: CoinCount, classicRoyalBonus: boolean): number {
  if (row.category === "royal_flush" && classicRoyalBonus && coinCount === MAX_COINS) {
    return ROYAL_MAX_BET_COINS;
  }
  return row.multiplier * coinCount;
}

// ── Winning-card highlight (spec §30) ──────────────────────────────────────────

function indexesByRankGroupSize(cards: Card[], size: number): number[] {
  const byRank = new Map<Rank, number[]>();
  cards.forEach((card, i) => {
    const arr = byRank.get(card.rank) ?? [];
    arr.push(i);
    byRank.set(card.rank, arr);
  });
  const out: number[] = [];
  for (const idxs of byRank.values()) {
    if (idxs.length === size) out.push(...idxs);
  }
  return out.sort((a, b) => a - b);
}

/** Indexes of the cards that make the winning hand (for UI highlight). */
export function getWinningCardIndexes(cards: Card[], result: PayoutResult): number[] {
  const all = [0, 1, 2, 3, 4];
  switch (result.category) {
    case "royal_flush":
    case "straight_flush":
    case "full_house":
    case "flush":
    case "straight":
      return all;
    case "four_of_a_kind":
      return indexesByRankGroupSize(cards, 4);
    case "three_of_a_kind":
      return indexesByRankGroupSize(cards, 3);
    case "two_pair":
      return indexesByRankGroupSize(cards, 2); // both pairs → 4 indexes
    case "one_pair":
      return indexesByRankGroupSize(cards, 2); // JoB → the pair (2 indexes)
    default:
      return [];
  }
}
