import { useCallback, useRef, useState } from "react";
import type { Rate } from "@/types/casino";
import type { Card } from "@/types/card";
import { shuffledDeck } from "@/games/shared/poker/deck";
import { rankFiveCardHand, type HandRank } from "@/games/shared/poker/handEvaluator";
import { buildVideoPokerResult, videoPokerBet } from "../adapter";
import { classifyVideoPoker, type PayoutLine } from "../logic/payout";
import type { GameEconomy } from "@/games/shared/economy";

export type VideoPokerPhase = "ready" | "draw" | "result";

const HAND_SIZE = 5;

type UseVideoPoker = {
  hand: (Card | undefined)[];
  held: boolean[];
  phase: VideoPokerPhase;
  lastRank: HandRank | null;
  lastLine: PayoutLine | null;
  bet: number;
  canDeal: boolean;
  canDraw: boolean;
  deal: () => void;
  draw: () => void;
  toggleHold: (index: number) => void;
};

/**
 * Video Poker flow: DEAL (placeBet) → Hold → DRAW (evaluate + settle). Spec §9.2.
 * The economy is INJECTED (not pulled from the store), so the same logic runs against
 * the real casinoStore in production and a mock in the in-repo sandbox.
 */
export function useVideoPoker(
  rate: Rate,
  economy: GameEconomy,
  onInsufficient: () => void,
): UseVideoPoker {
  // Keep the latest economy in a ref so deal/draw stay stable while chips stay live.
  const economyRef = useRef(economy);
  economyRef.current = economy;

  const [deck, setDeck] = useState<Card[]>([]);
  const [hand, setHand] = useState<(Card | undefined)[]>(Array(HAND_SIZE).fill(undefined));
  const [held, setHeld] = useState<boolean[]>(Array(HAND_SIZE).fill(false));
  const [phase, setPhase] = useState<VideoPokerPhase>("ready");
  const [lastRank, setLastRank] = useState<HandRank | null>(null);
  const [lastLine, setLastLine] = useState<PayoutLine | null>(null);

  const bet = videoPokerBet(rate);
  const canDeal = phase !== "draw" && economy.chips >= bet;
  const canDraw = phase === "draw";

  const deal = useCallback(() => {
    if (phase === "draw") return;
    if (!economyRef.current.placeBet(bet)) {
      onInsufficient();
      return;
    }
    const fresh = shuffledDeck();
    setHand(fresh.slice(0, HAND_SIZE));
    setDeck(fresh.slice(HAND_SIZE));
    setHeld(Array(HAND_SIZE).fill(false));
    setLastRank(null);
    setLastLine(null);
    setPhase("draw");
  }, [phase, bet, onInsufficient]);

  const toggleHold = useCallback(
    (index: number) => {
      if (phase !== "draw") return;
      setHeld((prev) => prev.map((h, i) => (i === index ? !h : h)));
    },
    [phase],
  );

  const draw = useCallback(() => {
    if (phase !== "draw") return;

    // Replace non-held cards from the remaining deck.
    const rest = [...deck];
    const finalHand = hand.map((card, i) => (held[i] ? card : rest.shift())) as Card[];

    const rank = rankFiveCardHand(finalHand);
    const line = classifyVideoPoker(rank);

    economyRef.current.settle(buildVideoPokerResult(rank, rate));

    setHand(finalHand);
    setDeck(rest);
    setLastRank(rank);
    setLastLine(line);
    setPhase("result");
  }, [phase, deck, hand, held, rate]);

  return {
    hand,
    held,
    phase,
    lastRank,
    lastLine,
    bet,
    canDeal,
    canDraw,
    deal,
    draw,
    toggleHold,
  };
}
