import { compareHandRank } from "@/games/shared/poker/handEvaluator";
import type { Card } from "@/types/card";
import type { HoldemSeat, HoldemShowdownHand } from "../types";
import { rankBestOfSeven } from "./holdemEvaluator";

function asHoleCards(cards: readonly Card[]): [Card, Card] {
  if (cards.length !== 2) throw new Error(`Expected 2 hole cards, got ${cards.length}`);
  return [cards[0]!, cards[1]!];
}

function asCommunityCards(cards: readonly Card[]): [Card, Card, Card, Card, Card] {
  if (cards.length !== 5) throw new Error(`Expected 5 community cards, got ${cards.length}`);
  return [cards[0]!, cards[1]!, cards[2]!, cards[3]!, cards[4]!];
}

export function evaluateShowdown(
  seats: readonly HoldemSeat[],
  communityCards: readonly Card[],
): { showdownHands: HoldemShowdownHand[]; winnerSeatIndexes: number[] } {
  const community = asCommunityCards(communityCards);
  const showdownHands = seats
    .filter((seat) => seat.status === "active" || seat.status === "allIn")
    .map((seat) => ({
      seatIndex: seat.seatIndex,
      seatId: seat.id,
      bestHand: rankBestOfSeven(asHoleCards(seat.holeCards), community),
    }));

  let winners: HoldemShowdownHand[] = [];
  for (const hand of showdownHands) {
    if (winners.length === 0) {
      winners = [hand];
      continue;
    }

    const comparison = compareHandRank(hand.bestHand.rank, winners[0]!.bestHand.rank);
    if (comparison > 0) winners = [hand];
    if (comparison === 0) winners.push(hand);
  }

  return {
    showdownHands,
    winnerSeatIndexes: winners.map((winner) => winner.seatIndex),
  };
}
