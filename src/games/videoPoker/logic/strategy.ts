// games/videoPoker/logic/strategy.ts — optimal-hold advisor (spec §20 Phase 5).
// For each of the 32 hold masks, computes the exact expected value over every possible
// draw from the 47 unseen cards, and returns the EV-maximising hold. Pure & testable.
import type { Card, Suit } from "@/types/card";
import { createDeck } from "@/games/shared/poker/deck";
import { ROYAL_MAX_BET_COINS, MAX_COINS, type CoinCount } from "./payout";

const SUIT_INDEX: Record<Suit, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };

// Reused across the (millions of) evaluations to avoid per-call allocation.
const COUNTS = new Array<number>(15).fill(0);

/**
 * Jacks-or-Better per-coin multiplier for 5 numeric cards. `royalPerCoin` is 250 normally,
 * or 800 (4000/5) when the classic MAX-BET Royal bonus applies. Mirrors evaluatePayout.
 */
export function fastMultiplier(rank5: number[], suit5: number[], royalPerCoin: number): number {
  for (let r = 2; r <= 14; r++) COUNTS[r] = 0;
  let flush = true;
  const s0 = suit5[0]!;
  for (let i = 0; i < 5; i++) {
    COUNTS[rank5[i]!]!++;
    if (suit5[i] !== s0) flush = false;
  }

  let distinct = 0;
  let min = 15;
  let max = 0;
  let pairCount = 0;
  let pairRankMax = 0;
  let three = false;
  let four = false;
  for (let r = 2; r <= 14; r++) {
    const c = COUNTS[r]!;
    if (!c) continue;
    distinct++;
    if (r < min) min = r;
    if (r > max) max = r;
    if (c === 2) {
      pairCount++;
      if (r > pairRankMax) pairRankMax = r;
    } else if (c === 3) three = true;
    else if (c === 4) four = true;
  }

  let straight = false;
  if (distinct === 5) {
    if (max - min === 4) straight = true;
    else if (COUNTS[14] && COUNTS[2] && COUNTS[3] && COUNTS[4] && COUNTS[5]) straight = true; // wheel
  }

  if (straight && flush) return max === 14 && min === 10 ? royalPerCoin : 50;
  if (four) return 25;
  if (three && pairCount === 1) return 9; // full house
  if (flush) return 6;
  if (straight) return 4;
  if (three) return 3;
  if (pairCount === 2) return 2;
  if (pairCount === 1) return pairRankMax >= 11 ? 1 : 0; // Jacks or Better
  return 0;
}

/** Iterate every k-combination of indices [0..n), reusing the index buffer. */
function forEachCombo(n: number, k: number, cb: (idx: number[]) => void): void {
  if (k === 0) {
    cb([]);
    return;
  }
  const idx = new Array<number>(k);
  for (let i = 0; i < k; i++) idx[i] = i;
  for (;;) {
    cb(idx);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]!++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

export type HoldAdvice = { mask: boolean[]; evCoins: number };

/** The EV-maximising hold for the dealt 5 cards, in per-coin units. */
export function bestHold(
  cards: Card[],
  coinCount: CoinCount,
  classicRoyalBonus: boolean,
): HoldAdvice {
  if (cards.length !== 5) throw new Error(`bestHold expects 5 cards, got ${cards.length}`);

  const royalPerCoin =
    classicRoyalBonus && coinCount === MAX_COINS ? ROYAL_MAX_BET_COINS / MAX_COINS : 250;

  const handR = cards.map((c) => c.rank as number);
  const handS = cards.map((c) => SUIT_INDEX[c.suit]);

  const seen = new Set(cards.map((c) => c.id));
  const unseenR: number[] = [];
  const unseenS: number[] = [];
  for (const c of createDeck()) {
    if (!seen.has(c.id)) {
      unseenR.push(c.rank);
      unseenS.push(SUIT_INDEX[c.suit]);
    }
  }
  const n = unseenR.length; // 47

  const bufR = new Array<number>(5);
  const bufS = new Array<number>(5);
  let bestEv = -1;
  let bestMask = 0;

  for (let mask = 0; mask < 32; mask++) {
    let h = 0;
    for (let i = 0; i < 5; i++) {
      if (mask & (1 << i)) {
        bufR[h] = handR[i]!;
        bufS[h] = handS[i]!;
        h++;
      }
    }
    const need = 5 - h;
    let sum = 0;
    let cnt = 0;
    forEachCombo(n, need, (idx) => {
      for (let j = 0; j < need; j++) {
        bufR[h + j] = unseenR[idx[j]!]!;
        bufS[h + j] = unseenS[idx[j]!]!;
      }
      sum += fastMultiplier(bufR, bufS, royalPerCoin);
      cnt++;
    });
    const ev = cnt > 0 ? sum / cnt : 0;
    if (ev > bestEv) {
      bestEv = ev;
      bestMask = mask;
    }
  }

  return {
    mask: [0, 1, 2, 3, 4].map((i) => (bestMask & (1 << i)) !== 0),
    evCoins: bestEv,
  };
}
