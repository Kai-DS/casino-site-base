import { compareHandRank } from "@/games/shared/poker/handEvaluator";
import type {
  HandCategory,
  HoldemResult,
  HoldemSeat,
  HoldemSettlement,
  HoldemShowdownHand,
  Pot,
  SidePot,
} from "../types";

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

export function buildSidePots(seats: readonly HoldemSeat[]): SidePot[] {
  const contributionLevels = [...new Set(
    seats
      .map((seat) => seat.totalContribution)
      .filter((amount) => amount > 0),
  )].sort((a, b) => a - b);

  const sidePots: SidePot[] = [];
  let previousCap = 0;
  for (const cap of contributionLevels) {
    const contributors = seats.filter((seat) => seat.totalContribution >= cap);
    const amount = (cap - previousCap) * contributors.length;
    const eligibleSeatIds = contributors
      .filter((seat) => seat.status !== "folded" && seat.status !== "sittingOut" && seat.status !== "busted")
      .map((seat) => seat.id);

    if (amount > 0) {
      sidePots.push({ amount, eligibleSeatIds, cap });
    }
    previousCap = cap;
  }

  return sidePots;
}

function awardShare(
  wonBySeatId: Map<string, number>,
  winners: readonly HoldemSeat[],
  amount: number,
  dealerButtonIndex: number | null,
) {
  const orderedWinners = orderWinnersForRemainder(winners, dealerButtonIndex);
  if (orderedWinners.length === 0 || amount <= 0) return;

  const share = Math.floor(amount / orderedWinners.length);
  let remainder = amount % orderedWinners.length;
  for (const winner of orderedWinners) {
    const wonAmount = share + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    wonBySeatId.set(winner.id, (wonBySeatId.get(winner.id) ?? 0) + wonAmount);
  }
}

function buildSettlementsFromWonMap(
  seats: readonly HoldemSeat[],
  wonBySeatId: ReadonlyMap<string, number>,
): HoldemSettlement[] {
  return seats.map((seat) => {
    const wonAmount = wonBySeatId.get(seat.id) ?? 0;
    return {
      seatIndex: seat.seatIndex,
      seatId: seat.id,
      wonAmount,
      profit: wonAmount - seat.totalContribution,
      isHuman: seat.isHuman,
    };
  });
}

export function buildSidePotSettlements(params: {
  seats: readonly HoldemSeat[];
  showdownHands: readonly HoldemShowdownHand[];
  dealerButtonIndex: number | null;
}): { settlements: HoldemSettlement[]; sidePots: SidePot[] } {
  const sidePots = buildSidePots(params.seats);
  const wonBySeatId = new Map<string, number>();

  for (const sidePot of sidePots) {
    const eligibleHands = params.showdownHands.filter((hand) => sidePot.eligibleSeatIds.includes(hand.seatId));
    if (eligibleHands.length === 0) continue;

    let winningHands: HoldemShowdownHand[] = [];
    for (const hand of eligibleHands) {
      if (winningHands.length === 0) {
        winningHands = [hand];
        continue;
      }

      const comparison = compareHandRank(hand.bestHand.rank, winningHands[0]!.bestHand.rank);
      if (comparison > 0) winningHands = [hand];
      if (comparison === 0) winningHands.push(hand);
    }

    const winners = params.seats.filter((seat) =>
      winningHands.some((hand) => hand.seatId === seat.id),
    );
    awardShare(wonBySeatId, winners, sidePot.amount, params.dealerButtonIndex);
  }

  return {
    settlements: buildSettlementsFromWonMap(params.seats, wonBySeatId),
    sidePots,
  };
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
  const sidePots = buildSidePots(params.seats);
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
    sidePots,
    playerWonAmount: playerSettlement?.wonAmount ?? 0,
    playerProfit: playerSettlement?.profit ?? 0,
    winningCategory: "fold",
  };
}

export function buildShowdownResult(params: {
  handId: number;
  seats: readonly HoldemSeat[];
  winnerSeatIndexes: readonly number[];
  showdownHands: readonly HoldemShowdownHand[];
  pot: Pot;
  dealerButtonIndex: number | null;
}): HoldemResult {
  const { settlements, sidePots } = buildSidePotSettlements({
    seats: params.seats,
    showdownHands: params.showdownHands,
    dealerButtonIndex: params.dealerButtonIndex,
  });
  const playerSettlement = settlements.find((settlement) => settlement.isHuman);
  const winners = settlements.filter((settlement) => settlement.wonAmount > 0);
  const winningHand = params.showdownHands.find((hand) =>
    params.winnerSeatIndexes.includes(hand.seatIndex),
  );

  return {
    handId: params.handId,
    reason: "showdown",
    winners,
    settlements,
    showdownHands: params.showdownHands.slice(),
    totalPotAmount: params.pot.amount,
    sidePots,
    playerWonAmount: playerSettlement?.wonAmount ?? 0,
    playerProfit: playerSettlement?.profit ?? 0,
    winningCategory: winningHand?.bestHand.rank.category as HandCategory,
  };
}
