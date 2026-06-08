// sandbox/videoPoker/scenarios.ts — fixed decks to reproduce any hand on demand (spec §33.2).
// First 5 cards = the dealt hand; the 6th onward = replacement order.
import type { Card, Rank, Suit } from "@/types/card";
import { cardId } from "@/types/card";
import { createDeck } from "@/games/shared/poker/deck";

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), suit, rank });
const S: Suit = "spades";
const H: Suit = "hearts";
const D: Suit = "diamonds";
const C: Suit = "clubs";

/** Front cards first, then the rest of a real deck so the provider is always a valid 52-card set. */
function build(front: Card[]): Card[] {
  const used = new Set(front.map((x) => x.id));
  return [...front, ...createDeck().filter((x) => !used.has(x.id))];
}

export type Scenario = { id: string; label: string; deck: Card[] };

export const SCENARIOS: readonly Scenario[] = [
  { id: "royalPat", label: "Royal (pat)", deck: build([c(10, S), c(11, S), c(12, S), c(13, S), c(14, S)]) },
  // 4-to-royal + off card; the 6th card (10♠) completes it on a 1-card draw.
  { id: "royalDraw", label: "Royal (draw 1)", deck: build([c(14, S), c(13, S), c(12, S), c(11, S), c(2, C), c(10, S)]) },
  { id: "straightFlush", label: "Straight Flush", deck: build([c(9, H), c(10, H), c(11, H), c(12, H), c(13, H)]) },
  { id: "quads", label: "Four of a Kind", deck: build([c(9, S), c(9, H), c(9, D), c(9, C), c(13, S)]) },
  { id: "fullHouse", label: "Full House", deck: build([c(9, S), c(9, H), c(9, D), c(13, S), c(13, H)]) },
  { id: "flush", label: "Flush", deck: build([c(2, H), c(5, H), c(9, H), c(11, H), c(13, H)]) },
  { id: "straight", label: "Straight", deck: build([c(5, D), c(6, S), c(7, H), c(8, C), c(9, D)]) },
  { id: "trips", label: "Three of a Kind", deck: build([c(9, S), c(9, H), c(9, D), c(2, C), c(13, H)]) },
  { id: "twoPair", label: "Two Pair", deck: build([c(9, S), c(9, H), c(13, S), c(13, H), c(3, D)]) },
  { id: "jacks", label: "Jacks or Better", deck: build([c(11, S), c(11, H), c(3, D), c(4, C), c(9, H)]) },
  { id: "lowPair", label: "Low Pair (no pay)", deck: build([c(10, S), c(10, H), c(3, D), c(4, C), c(9, H)]) },
  { id: "noWin", label: "No Win", deck: build([c(2, H), c(5, S), c(9, D), c(11, C), c(13, H)]) },
];
