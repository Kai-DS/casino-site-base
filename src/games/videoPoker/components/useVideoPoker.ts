import { useCallback, useState } from "react";
import type { Rate } from "@/types/casino";
import type { Card } from "@/types/card";
import { shuffledDeck } from "@/games/shared/poker/deck";
import { rankFiveCardHand, type HandRank } from "@/games/shared/poker/handEvaluator";
import { buildVideoPokerResult, videoPokerBet } from "../adapter";
import { classifyVideoPoker, type PayoutLine } from "../logic/payout";
import { useCasinoStore } from "@/store/casinoStore";

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

/** Video Poker flow: DEAL (placeBet) → Hold → DRAW (evaluate + applyGameResult). Spec §9.2. */
export function useVideoPoker(rate: Rate, onInsufficient: () => void): UseVideoPoker {
  const placeBet = useCasinoStore((s) => s.placeBet);
  const applyGameResult = useCasinoStore((s) => s.applyGameResult);
  const chips = useCasinoStore((s) => s.user?.chips ?? 0);

  const [deck, setDeck] = useState<Card[]>([]);
  const [hand, setHand] = useState<(Card | undefined)[]>(Array(HAND_SIZE).fill(undefined));
  const [held, setHeld] = useState<boolean[]>(Array(HAND_SIZE).fill(false));
  const [phase, setPhase] = useState<VideoPokerPhase>("ready");
  const [lastRank, setLastRank] = useState<HandRank | null>(null);
  const [lastLine, setLastLine] = useState<PayoutLine | null>(null);

  const bet = videoPokerBet(rate);
  const canDeal = phase !== "draw" && chips >= bet;
  const canDraw = phase === "draw";

  const deal = useCallback(() => {
    if (phase === "draw") return;
    if (!placeBet("videoPoker", bet)) {
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
  }, [phase, placeBet, bet, onInsufficient]);

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

    applyGameResult(buildVideoPokerResult(rank, rate));

    setHand(finalHand);
    setDeck(rest);
    setLastRank(rank);
    setLastLine(line);
    setPhase("result");
  }, [phase, deck, hand, held, applyGameResult, rate]);

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
