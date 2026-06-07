import type { Card, RNG } from "@/types/card";
import { createDeck, shuffle } from "@/games/shared/poker/deck";

export type DeckProvider = () => Card[];

export type DeckValidationError = "DECK_EXHAUSTED" | "DUPLICATE_CARD";

export type DeckValidationResult =
  | { ok: true; deck: Card[] }
  | { ok: false; reason: DeckValidationError; message: string };

export const VIDEO_POKER_HAND_SIZE = 5;
export const VIDEO_POKER_MIN_DECK_SIZE = VIDEO_POKER_HAND_SIZE * 2;

export function createDefaultDeckProvider(rng?: RNG): DeckProvider {
  return () => shuffle(createDeck(), rng);
}

export function validateVideoPokerDeck(
  deck: readonly Card[],
  minCards = VIDEO_POKER_MIN_DECK_SIZE,
): DeckValidationResult {
  if (deck.length < minCards) {
    return {
      ok: false,
      reason: "DECK_EXHAUSTED",
      message: "デッキのカードが不足しています。",
    };
  }

  const ids = new Set<string>();
  const faces = new Set<string>();
  for (const card of deck) {
    const face = `${card.suit}-${card.rank}`;
    if (ids.has(card.id) || faces.has(face)) {
      return {
        ok: false,
        reason: "DUPLICATE_CARD",
        message: "デッキに重複カードがあります。",
      };
    }
    ids.add(card.id);
    faces.add(face);
  }

  return { ok: true, deck: deck.slice() };
}
