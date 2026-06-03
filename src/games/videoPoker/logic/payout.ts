// games/videoPoker/logic/payout.ts — Jacks or Better (9/6) paytable. Pure, Vitest-tested. Spec §9.2.
import type { HandRank } from "@/games/shared/poker/handEvaluator";
import { HAND_CATEGORY } from "@/games/shared/poker/handEvaluator";
import { RANK_VALUE } from "@/types/card";

export type PayoutLine = { label: string; multiplier: number };

/** Display paytable, strongest first (multipliers are ×betUnit). */
export const PAYTABLE: readonly PayoutLine[] = [
  { label: "Royal Flush", multiplier: 250 },
  { label: "Straight Flush", multiplier: 50 },
  { label: "Four of a Kind", multiplier: 25 },
  { label: "Full House", multiplier: 9 },
  { label: "Flush", multiplier: 6 },
  { label: "Straight", multiplier: 4 },
  { label: "Three of a Kind", multiplier: 3 },
  { label: "Two Pair", multiplier: 2 },
  { label: "Jacks or Better", multiplier: 1 },
];

const NOTHING: PayoutLine = { label: "No Win", multiplier: 0 };

/** Map a ranked 5-card hand to its Jacks-or-Better payout line. */
export function classifyVideoPoker(hand: HandRank): PayoutLine {
  switch (hand.category) {
    case HAND_CATEGORY.RoyalFlush:
      return PAYTABLE[0]!;
    case HAND_CATEGORY.StraightFlush:
      return PAYTABLE[1]!;
    case HAND_CATEGORY.FourOfAKind:
      return PAYTABLE[2]!;
    case HAND_CATEGORY.FullHouse:
      return PAYTABLE[3]!;
    case HAND_CATEGORY.Flush:
      return PAYTABLE[4]!;
    case HAND_CATEGORY.Straight:
      return PAYTABLE[5]!;
    case HAND_CATEGORY.ThreeOfAKind:
      return PAYTABLE[6]!;
    case HAND_CATEGORY.TwoPair:
      return PAYTABLE[7]!;
    case HAND_CATEGORY.Pair:
      // Only a pair of Jacks or better pays.
      return (hand.tiebreak[0] ?? 0) >= RANK_VALUE.J ? PAYTABLE[8]! : NOTHING;
    default:
      return NOTHING;
  }
}
