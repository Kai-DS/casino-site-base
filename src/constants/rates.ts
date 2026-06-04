// constants/rates.ts — 6-tier rate system. See spec §8 (revised: buy-in ranges + bet ranges).
import type { Rate, RateId } from "@/types/casino";

export const RATES: readonly Rate[] = [
  { id: "low", label: "LOW", buyInMin: 100, buyInMax: 500, betMin: 1, betMax: 5, blurb: "最初の練習台" },
  { id: "middle", label: "MIDDLE", buyInMin: 1_000, buyInMax: 5_000, betMin: 10, betMax: 50, blurb: "普通に遊ぶ台" },
  { id: "high", label: "HIGH", buyInMin: 5_000, buyInMax: 25_000, betMin: 50, betMax: 250, blurb: "かなりヒリつく" },
  { id: "vip", label: "VIP", buyInMin: 10_000, buyInMax: 50_000, betMin: 100, betMax: 500, blurb: "上級者向け" },
  { id: "royal", label: "ROYAL", buyInMin: 50_000, buyInMax: 250_000, betMin: 500, betMax: 2_500, blurb: "大勝負台" },
  { id: "legend", label: "LEGEND", buyInMin: 100_000, buyInMax: 500_000, betMin: 1_000, betMax: 5_000, blurb: "最上位台" },
];

export const RATE_BY_ID: Record<RateId, Rate> = Object.fromEntries(
  RATES.map((r) => [r.id, r]),
) as Record<RateId, Rate>;

/** LOW.buyInMin — bankruptcy threshold (can't even buy into the cheapest table). See §5.4. */
export const BANKRUPTCY_THRESHOLD = RATE_BY_ID.low.buyInMin; // 100

/** Whether the balance can sit at this rate (buy-in min is the only eligibility gate). */
export function canAfford(rate: Rate, chips: number): boolean {
  return chips >= rate.buyInMin;
}

/** Highest rate the balance is eligible for, or null if even LOW is out of reach. */
export function highestAffordableRate(chips: number): Rate | null {
  let best: Rate | null = null;
  for (const r of RATES) {
    if (canAfford(r, chips)) best = r;
  }
  return best;
}

/** Buy-in amount is clamped to [buyInMin, min(buyInMax, chips)]. */
export function clampBuyIn(rate: Rate, amount: number, chips: number): number {
  const max = Math.min(rate.buyInMax, chips);
  return Math.max(rate.buyInMin, Math.min(amount, max));
}

// ── Bet (coin) helpers: a bet is 1..5 coins, each coin worth betMin. ──
export const MAX_COINS = 5;

export function coinsForBet(rate: Rate, bet: number): number {
  return Math.round(bet / rate.betMin);
}

export function isMaxBet(rate: Rate, bet: number): boolean {
  return bet >= rate.betMax;
}

/** The five selectable bet amounts: [betMin … betMax]. */
export function betSteps(rate: Rate): number[] {
  return Array.from({ length: MAX_COINS }, (_, i) => rate.betMin * (i + 1));
}
