import { colorOf } from "../constants/wheel";
import { POSITION_TABLE } from "../constants/positions";
import type { BetOutcome, BetPosition, PlacedBet, PositionId, SpinResult, SpinSettlement } from "../types";

export function buildSpinResult(n: number): SpinResult {
  if (n === 0) {
    return { number: 0, color: "green", parity: null, range: null, dozen: null, column: null };
  }
  return {
    number: n,
    color: colorOf(n),
    parity: n % 2 === 1 ? "odd" : "even",
    range: n <= 18 ? "low" : "high",
    dozen: Math.ceil(n / 12) as 1 | 2 | 3,
    column: (((n - 1) % 3) + 1) as 1 | 2 | 3,
  };
}

export function resolveSpin(
  bets: readonly PlacedBet[],
  winning: number,
  positions: Readonly<Record<PositionId, BetPosition>> = POSITION_TABLE,
): SpinSettlement {
  const result = buildSpinResult(winning);
  const outcomes = bets.map((b): BetOutcome => {
    const pos = positions[b.positionId];
    if (!pos) throw new Error(`Unknown roulette position: ${b.positionId}`);
    const won = pos.coveredNumbers.includes(winning);
    return {
      betId: b.betId,
      positionId: b.positionId,
      amount: b.amount,
      won,
      returned: won ? b.amount * (pos.payout + 1) : 0,
    };
  });
  const totalBet = outcomes.reduce((sum, o) => sum + o.amount, 0);
  const totalReturned = outcomes.reduce((sum, o) => sum + o.returned, 0);

  return {
    result,
    outcomes,
    totalBet,
    totalReturned,
    profit: totalReturned - totalBet,
    winningBetIds: outcomes.filter((o) => o.won).map((o) => o.betId),
    losingBetIds: outcomes.filter((o) => !o.won).map((o) => o.betId),
  };
}
