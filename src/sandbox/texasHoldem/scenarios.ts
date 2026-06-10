import type { Card, Rank, Suit } from "@/types/card";
import { cardId } from "@/types/card";
import { createDeck } from "@/games/shared/poker/deck";

const S: Suit = "spades";
const H: Suit = "hearts";
const D: Suit = "diamonds";
const C: Suit = "clubs";

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), suit, rank });

function build(front: Card[]): Card[] {
  const used = new Set(front.map((card) => card.id));
  return [...front, ...createDeck().filter((card) => !used.has(card.id))];
}

export type HoldemSandboxScenarioId =
  | "showdown-player-win"
  | "fold-win"
  | "split-pot"
  | "all-in-auto-reveal"
  | "available-actions"
  | "animation-events";

export interface HoldemSandboxScenario {
  id: HoldemSandboxScenarioId;
  label: string;
  description: string;
  deck: Card[];
}

const showdownPlayerWinDeck = build([
  c(2, C), c(3, C), c(4, C), c(5, C), c(6, C),
  c(7, C), c(8, C), c(9, C), c(10, C), c(11, C),
  c(12, C), c(13, C), c(14, C), c(2, H), c(3, H),
]);

const foldWinDeck = build([
  c(2, C), c(3, D), c(4, C), c(5, D), c(14, C),
  c(7, H), c(8, S), c(9, H), c(10, S), c(14, H),
  c(12, C), c(13, C), c(14, S), c(2, H), c(3, H),
]);

const splitPotDeck = build([
  c(2, S), c(3, S), c(4, S), c(5, S), c(6, S),
  c(7, S), c(8, S), c(9, S), c(2, D), c(3, D),
  c(10, C), c(11, C), c(12, C), c(13, C), c(14, C),
]);

export const HOLDEM_SANDBOX_SCENARIOS: readonly HoldemSandboxScenario[] = [
  {
    id: "showdown-player-win",
    label: "Showdown win",
    description: "Headless call/check path to river showdown; player wins with the club flush kicker.",
    deck: showdownPlayerWinDeck,
  },
  {
    id: "fold-win",
    label: "Fold win",
    description: "Player raise forces weak CPU hands to fold, producing a fold result with no showdown ranks.",
    deck: foldWinDeck,
  },
  {
    id: "split-pot",
    label: "Split pot",
    description: "Royal flush on the board creates a multi-way split pot at showdown.",
    deck: splitPotDeck,
  },
  {
    id: "all-in-auto-reveal",
    label: "All-in reveal",
    description: "Player all-in skips remaining betting rounds and auto-reveals five community cards.",
    deck: showdownPlayerWinDeck,
  },
  {
    id: "available-actions",
    label: "Available actions",
    description: "Stops on the first preflop player decision for action enabled/reason inspection.",
    deck: showdownPlayerWinDeck,
  },
  {
    id: "animation-events",
    label: "Animation events",
    description: "Animation-enabled startHand emits a deterministic blind/deal event queue.",
    deck: showdownPlayerWinDeck,
  },
];

export function findHoldemSandboxScenario(id: HoldemSandboxScenarioId): HoldemSandboxScenario {
  const scenario = HOLDEM_SANDBOX_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Unknown Holdem sandbox scenario: ${id}`);
  return scenario;
}
