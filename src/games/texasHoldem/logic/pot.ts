import type { HoldemResult, HoldemSeat, HoldemSettlement, Pot } from "../types";

export function orderWinnersForRemainder(
  winners: readonly HoldemSeat[],
  dealerButtonIndex: number | null,
): HoldemSeat[] {
  if (dealerButtonIndex === null) {
    return winners.slice().sort((a, b) => a.seatIndex - b.seatIndex);
  }

  return winners
    .slice()
    .sort((a, b) => {
      const distanceA = (a.seatIndex - dealerButtonIndex + 5) % 5 || 5;
      const distanceB = (b.seatIndex - dealerButtonIndex + 5) % 5 || 5;
      return distanceA - distanceB || a.seatIndex - b.seatIndex;
    });
}

export function buildSettlements(
  seats: readonly HoldemSeat[],
  winnerSeatIndexes: readonly number[],
  totalPotAmount: number,
  dealerButtonIndex: number | null,
): HoldemSettlement[] {
  const winners = orderWinnersForRemainder(
    seats.filter((seat) => winnerSeatIndexes.includes(seat.seatIndex)),
    dealerButtonIndex,
  );
  if (winners.length === 0) return [];

  const share = Math.floor(totalPotAmount / winners.length);
  let remainder = totalPotAmount % winners.length;

  return seats.map((seat) => {
    const winner = winners.find((candidate) => candidate.id === seat.id);
    let wonAmount = 0;
    if (winner) {
      wonAmount = share;
      if (remainder > 0) {
        wonAmount += 1;
        remainder -= 1;
      }
    }

    return {
      seatIndex: seat.seatIndex,
      seatId: seat.id,
      wonAmount,
      profit: wonAmount - seat.totalContribution,
      isHuman: seat.isHuman,
    };
  });
}

export function applySettlementsToSeats(
  seats: readonly HoldemSeat[],
  settlements: readonly HoldemSettlement[],
): HoldemSeat[] {
  return seats.map((seat) => {
    const settlement = settlements.find((candidate) => candidate.seatId === seat.id);
    if (!settlement || settlement.wonAmount === 0) return { ...seat };
    return { ...seat, tableStack: seat.tableStack + settlement.wonAmount };
  });
}

export function buildFoldResult(params: {
  handId: number;
  seats: readonly HoldemSeat[];
  winnerSeatIndex: number;
  pot: Pot;
  dealerButtonIndex: number | null;
}): HoldemResult {
  const settlements = buildSettlements(
    params.seats,
    [params.winnerSeatIndex],
    params.pot.amount,
    params.dealerButtonIndex,
  );
  const playerSettlement = settlements.find((settlement) => settlement.isHuman);
  const winner = settlements.find((settlement) => settlement.wonAmount > 0);

  return {
    handId: params.handId,
    reason: "fold",
    winners: winner ? [winner] : [],
    settlements,
    showdownHands: [],
    totalPotAmount: params.pot.amount,
    playerWonAmount: playerSettlement?.wonAmount ?? 0,
    playerProfit: playerSettlement?.profit ?? 0,
    winningCategory: "fold",
  };
}
