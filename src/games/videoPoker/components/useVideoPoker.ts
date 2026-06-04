import { useCallback, useRef, useState } from "react";
import type { Rate } from "@/types/casino";
import type { Card } from "@/types/card";
import { shuffledDeck } from "@/games/shared/poker/deck";
import { rankFiveCardHand, type HandRank } from "@/games/shared/poker/handEvaluator";
import { buildVideoPokerResult, videoPokerPayout } from "../adapter";
import { classifyVideoPoker, type PayoutLine } from "../logic/payout";
import { MAX_COINS } from "@/constants/rates";
import type { GameEconomy } from "@/games/shared/economy";

export type VideoPokerPhase = "ready" | "draw" | "result";

const HAND_SIZE = 5;

type UseVideoPoker = {
  hand: (Card | undefined)[];
  held: boolean[];
  phase: VideoPokerPhase;
  lastRank: HandRank | null;
  lastLine: PayoutLine | null;
  lastPayout: number | null;
  coins: number; // selected bet size, 1..MAX_COINS
  bet: number; // coins × betMin
  dealtBet: number; // bet locked for the current hand
  canDeal: boolean;
  canDraw: boolean;
  canChangeBet: boolean;
  setCoins: (n: number) => void;
  betMax: () => void;
  deal: () => void;
  draw: () => void;
  toggleHold: (index: number) => void;
};

/**
 * Video Poker flow: pick bet (1..5 coins) → DEAL (placeBet) → Hold → DRAW (evaluate + settle).
 * Economy is injected, so the same logic runs against the store or the sandbox mock. Spec §9.2.
 */
export function useVideoPoker(
  rate: Rate,
  economy: GameEconomy,
  onInsufficient: () => void,
): UseVideoPoker {
  const economyRef = useRef(economy);
  economyRef.current = economy;

  const [coins, setCoinsState] = useState(1);
  const [deck, setDeck] = useState<Card[]>([]);
  const [hand, setHand] = useState<(Card | undefined)[]>(Array(HAND_SIZE).fill(undefined));
  const [held, setHeld] = useState<boolean[]>(Array(HAND_SIZE).fill(false));
  const [phase, setPhase] = useState<VideoPokerPhase>("ready");
  const [lastRank, setLastRank] = useState<HandRank | null>(null);
  const [lastLine, setLastLine] = useState<PayoutLine | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [dealtBet, setDealtBet] = useState(rate.betMin);

  const bet = rate.betMin * coins;
  const canChangeBet = phase !== "draw";
  const canDeal = phase !== "draw" && economy.chips >= bet;
  const canDraw = phase === "draw";

  const setCoins = useCallback(
    (n: number) => {
      if (phase === "draw") return;
      setCoinsState(Math.max(1, Math.min(MAX_COINS, Math.round(n))));
    },
    [phase],
  );
  const betMax = useCallback(() => setCoins(MAX_COINS), [setCoins]);

  const deal = useCallback(() => {
    if (phase === "draw") return;
    const stake = rate.betMin * coins;
    if (!economyRef.current.placeBet(stake)) {
      onInsufficient();
      return;
    }
    const fresh = shuffledDeck();
    setHand(fresh.slice(0, HAND_SIZE));
    setDeck(fresh.slice(HAND_SIZE));
    setHeld(Array(HAND_SIZE).fill(false));
    setLastRank(null);
    setLastLine(null);
    setLastPayout(null);
    setDealtBet(stake);
    setPhase("draw");
  }, [phase, rate.betMin, coins, onInsufficient]);

  const toggleHold = useCallback(
    (index: number) => {
      if (phase !== "draw") return;
      setHeld((prev) => prev.map((h, i) => (i === index ? !h : h)));
    },
    [phase],
  );

  const draw = useCallback(() => {
    if (phase !== "draw") return;

    const rest = [...deck];
    const finalHand = hand.map((card, i) => (held[i] ? card : rest.shift())) as Card[];

    const rank = rankFiveCardHand(finalHand);
    const line = classifyVideoPoker(rank);
    const payout = videoPokerPayout(rank, rate, dealtBet);

    economyRef.current.settle(buildVideoPokerResult(rank, rate, dealtBet));

    setHand(finalHand);
    setDeck(rest);
    setLastRank(rank);
    setLastLine(line);
    setLastPayout(payout);
    setPhase("result");
  }, [phase, deck, hand, held, rate, dealtBet]);

  return {
    hand,
    held,
    phase,
    lastRank,
    lastLine,
    lastPayout,
    coins,
    bet,
    dealtBet,
    canDeal,
    canDraw,
    canChangeBet,
    setCoins,
    betMax,
    deal,
    draw,
    toggleHold,
  };
}
