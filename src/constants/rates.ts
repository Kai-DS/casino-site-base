// constants/rates.ts — see spec §8
import type { Rate, RateId } from "@/types/casino";

export const RATES: readonly Rate[] = [
  { id: "low", label: "LOW", minBalance: 100, betUnit: 1 },
  { id: "middle", label: "MIDDLE", minBalance: 1000, betUnit: 10 },
  { id: "high", label: "HIGH", minBalance: 5000, betUnit: 50 },
  { id: "vip", label: "VIP", minBalance: 10000, betUnit: 100 },
];

export const RATE_BY_ID: Record<RateId, Rate> = Object.fromEntries(
  RATES.map((r) => [r.id, r]),
) as Record<RateId, Rate>;

/** LOW.minBalance — the bankruptcy threshold (cannot sit at the cheapest table). See §5.4. */
export const BANKRUPTCY_THRESHOLD = RATE_BY_ID.low.minBalance; // 100

/** Highest rate whose minBalance the given balance can afford, or null if even LOW is out of reach. */
export function highestAffordableRate(chips: number): Rate | null {
  let best: Rate | null = null;
  for (const r of RATES) {
    if (chips >= r.minBalance) best = r;
  }
  return best;
}
