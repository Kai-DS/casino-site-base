import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Rate } from "@/types/casino";
import type { Card, RNG } from "@/types/card";
import { take } from "@/games/shared/poker/deck";
import type { GameEconomy } from "@/games/shared/economy";
import { clampBuyIn } from "@/constants/rates";
import {
  evaluatePayout,
  getWinningCardIndexes,
  MAX_COINS,
  type CoinCount,
  type PayoutResult,
} from "../logic/payout";
import {
  createDefaultDeckProvider,
  validateVideoPokerDeck,
  VIDEO_POKER_HAND_SIZE,
  type DeckProvider,
} from "../logic/deckProvider";
import { buildVideoPokerResult, CLASSIC_ROYAL_BONUS } from "../adapter";

export type VideoPokerPhase = "unseated" | "buyIn" | "ready" | "draw" | "result";

export type VideoPokerActionError =
  | "ANIMATING"
  | "NOT_SEATED"
  | "INVALID_PHASE"
  | "INVALID_BET"
  | "INSUFFICIENT_CHIPS"
  | "INSUFFICIENT_TABLE_STACK"
  | "REBUY_REQUIRED"
  | "DECK_EXHAUSTED"
  | "DUPLICATE_CARD"
  | "ECONOMY_FAILED";

export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      reason: VideoPokerActionError;
      message: string;
    };

export type UseVideoPokerOptions = {
  initialTableStack?: number;
  rng?: RNG;
  deckProvider?: DeckProvider;
  classicRoyalBonus?: boolean;
};

export type UseVideoPoker = {
  hand: (Card | undefined)[];
  cards: Card[];
  held: boolean[];
  heldIndexes: Set<number>;
  phase: VideoPokerPhase;
  lastResult: PayoutResult | null;
  winningCardIndexes: number[];
  coins: CoinCount;
  coinCount: CoinCount;
  bet: number;
  currentBet: number;
  lockedBet: number | null;
  tableStack: number;
  canDeal: boolean;
  canDraw: boolean;
  canChangeBet: boolean;
  canRebuy: boolean;
  isAnimating: boolean;
  actionError: VideoPokerActionError | null;
  handId: number;
  setCoins: (n: number) => ActionResult;
  setCoinCount: (n: number) => ActionResult;
  betMax: () => ActionResult;
  maxBet: () => ActionResult;
  deal: () => ActionResult;
  draw: () => ActionResult;
  toggleHold: (index: number) => ActionResult;
  rebuy: (newTableStack: number) => ActionResult;
  clearResult: () => void;
};

const HAND_SIZE = VIDEO_POKER_HAND_SIZE;
const EMPTY_HAND: (Card | undefined)[] = Array(HAND_SIZE).fill(undefined);
const EMPTY_HOLDS = Array(HAND_SIZE).fill(false);
const OK: ActionResult = { ok: true };

function initialStackFor(rate: Rate, chips: number, requested?: number): number {
  if (chips < rate.buyInMin) return 0;
  return clampBuyIn(rate, requested ?? rate.buyInMin, chips);
}

function phaseFor(rate: Rate, chips: number, tableStack: number): VideoPokerPhase {
  if (tableStack >= rate.buyInMin) return "ready";
  return chips >= rate.buyInMin ? "buyIn" : "unseated";
}

/**
 * Video Poker flow: buy-in/tableStack is hook-owned, while `economy` only moves the real chips.
 * Per SPEC_VIDEO_POKER_v1.2 §11.1 and §25–§28.
 */
export function useVideoPoker(
  rate: Rate,
  economy: GameEconomy,
  onInsufficient: () => void,
  options: UseVideoPokerOptions = {},
): UseVideoPoker {
  const { initialTableStack, rng, deckProvider, classicRoyalBonus = CLASSIC_ROYAL_BONUS } = options;

  const economyRef = useRef(economy);
  economyRef.current = economy;

  const providerRef = useRef<DeckProvider>(deckProvider ?? createDefaultDeckProvider(rng));
  providerRef.current = deckProvider ?? createDefaultDeckProvider(rng);

  const startingStack = initialStackFor(rate, economy.chips, initialTableStack);
  const [tableStack, setTableStackState] = useState(startingStack);
  const tableStackRef = useRef(tableStack);
  const setTableStack = useCallback((next: number | ((current: number) => number)) => {
    const value = typeof next === "function" ? next(tableStackRef.current) : next;
    tableStackRef.current = value;
    setTableStackState(value);
  }, []);

  const [coins, setCoinsState] = useState<CoinCount>(1);
  const coinsRef = useRef<CoinCount>(coins);
  const setCoinsInternal = useCallback((next: CoinCount) => {
    coinsRef.current = next;
    setCoinsState(next);
  }, []);

  const [deck, setDeckState] = useState<Card[]>([]);
  const deckRef = useRef(deck);
  const setDeck = useCallback((next: Card[]) => {
    deckRef.current = next;
    setDeckState(next);
  }, []);

  const [hand, setHandState] = useState<(Card | undefined)[]>(EMPTY_HAND);
  const handRef = useRef(hand);
  const setHand = useCallback((next: (Card | undefined)[]) => {
    handRef.current = next;
    setHandState(next);
  }, []);

  const [held, setHeldState] = useState<boolean[]>(EMPTY_HOLDS);
  const heldRef = useRef(held);
  const setHeld = useCallback((next: boolean[] | ((current: boolean[]) => boolean[])) => {
    const value = typeof next === "function" ? next(heldRef.current) : next;
    heldRef.current = value;
    setHeldState(value);
  }, []);

  const [phase, setPhaseState] = useState<VideoPokerPhase>(
    phaseFor(rate, economy.chips, startingStack),
  );
  const phaseRef = useRef(phase);
  const setPhase = useCallback((next: VideoPokerPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const [lastResult, setLastResult] = useState<PayoutResult | null>(null);
  const [winningCardIndexes, setWinningCardIndexes] = useState<number[]>([]);
  const [lockedBet, setLockedBetState] = useState<number | null>(null);
  const lockedBetRef = useRef<number | null>(lockedBet);
  const setLockedBet = useCallback((next: number | null) => {
    lockedBetRef.current = next;
    setLockedBetState(next);
  }, []);
  const lockedCoinCountRef = useRef<CoinCount | null>(null);

  const [isAnimating, setIsAnimating] = useState(false);
  const [actionError, setActionError] = useState<VideoPokerActionError | null>(null);
  const [handId, setHandId] = useState(0);
  const handIdRef = useRef(0);
  const isResolvingRef = useRef(false);

  useEffect(() => {
    if (!isResolvingRef.current) return;
    isResolvingRef.current = false;
    setIsAnimating(false);
  }, [phase, handId]);

  const releaseResolving = useCallback(() => {
    isResolvingRef.current = false;
    setIsAnimating(false);
  }, []);

  const fail = useCallback((reason: VideoPokerActionError, message: string): ActionResult => {
    setActionError(reason);
    return { ok: false, reason, message };
  }, []);

  const succeed = useCallback((): ActionResult => {
    setActionError(null);
    return OK;
  }, []);

  const currentBet = rate.betMin * coins;
  const canAct = !isAnimating && !isResolvingRef.current;
  const canChangeBet = canAct && (phase === "ready" || phase === "result");
  const canDeal =
    canAct &&
    (phase === "ready" || phase === "result") &&
    economy.chips >= currentBet &&
    tableStack >= currentBet;
  const canDraw = canAct && phase === "draw";
  const canRebuy = canAct && phase !== "draw" && economy.chips >= rate.buyInMin;

  const cards = useMemo(
    () => hand.filter((card): card is Card => card !== undefined),
    [hand],
  );
  const heldIndexes = useMemo(() => {
    const indexes = new Set<number>();
    held.forEach((isHeld, index) => {
      if (isHeld) indexes.add(index);
    });
    return indexes;
  }, [held]);

  const setCoinCount = useCallback(
    (n: number): ActionResult => {
      if (isAnimating || isResolvingRef.current) return fail("ANIMATING", "演出中です。");
      if (phaseRef.current !== "ready" && phaseRef.current !== "result") {
        return fail("INVALID_PHASE", "現在BETは変更できません。");
      }
      if (!Number.isInteger(n) || n < 1 || n > MAX_COINS) {
        return fail("INVALID_BET", "BETが不正です。");
      }
      setCoinsInternal(n as CoinCount);
      return succeed();
    },
    [fail, isAnimating, setCoinsInternal, succeed],
  );

  const maxBet = useCallback(() => setCoinCount(MAX_COINS), [setCoinCount]);

  const deal = useCallback((): ActionResult => {
    if (isAnimating || isResolvingRef.current) return fail("ANIMATING", "演出中です。");
    const currentPhase = phaseRef.current;
    if (currentPhase === "unseated" || currentPhase === "buyIn") {
      return fail("NOT_SEATED", "まだ着席していません。");
    }
    if (currentPhase !== "ready" && currentPhase !== "result") {
      return fail("INVALID_PHASE", "今はDEALできません。");
    }

    const stake = rate.betMin * coinsRef.current;
    if (economyRef.current.chips < stake) {
      onInsufficient();
      return fail("INSUFFICIENT_CHIPS", "チップが不足しています。");
    }
    if (tableStackRef.current < stake) {
      const reason = tableStackRef.current < rate.betMin ? "REBUY_REQUIRED" : "INSUFFICIENT_TABLE_STACK";
      if (reason === "REBUY_REQUIRED") onInsufficient();
      return fail(reason, "テーブル残高が不足しています。BETを下げるか、REBUYしてください。");
    }

    const provided = validateVideoPokerDeck(providerRef.current());
    if (!provided.ok) return fail(provided.reason, provided.message);

    isResolvingRef.current = true;
    setIsAnimating(true);
    try {
      if (!economyRef.current.placeBet(stake)) {
        releaseResolving();
        return fail("ECONOMY_FAILED", "ベット処理に失敗しました。");
      }

      const { taken, rest } = take(provided.deck, HAND_SIZE);
      handIdRef.current += 1;
      setHandId(handIdRef.current);
      setTableStack((stack) => stack - stake);
      setLockedBet(stake);
      lockedCoinCountRef.current = coinsRef.current;
      setHand(taken);
      setDeck(rest);
      setHeld(EMPTY_HOLDS);
      setLastResult(null);
      setWinningCardIndexes([]);
      setPhase("draw");
      return succeed();
    } catch {
      releaseResolving();
      return fail("ECONOMY_FAILED", "ベット処理に失敗しました。");
    }
  }, [fail, isAnimating, onInsufficient, rate.betMin, releaseResolving, setDeck, setHand, setHeld, setLockedBet, setPhase, setTableStack, succeed]);

  const toggleHold = useCallback(
    (index: number): ActionResult => {
      if (isAnimating || isResolvingRef.current) return fail("ANIMATING", "演出中です。");
      if (phaseRef.current !== "draw") return fail("INVALID_PHASE", "現在HOLDは変更できません。");
      if (!Number.isInteger(index) || index < 0 || index >= HAND_SIZE) {
        return fail("INVALID_BET", "カード位置が不正です。");
      }
      setHeld((prev) => prev.map((isHeld, i) => (i === index ? !isHeld : isHeld)));
      return succeed();
    },
    [fail, isAnimating, setHeld, succeed],
  );

  const draw = useCallback((): ActionResult => {
    if (isAnimating || isResolvingRef.current) return fail("ANIMATING", "演出中です。");
    if (phaseRef.current !== "draw") return fail("INVALID_PHASE", "今はDRAWできません。");

    const replacements = heldRef.current.filter((isHeld) => !isHeld).length;
    if (deckRef.current.length < replacements) {
      return fail("DECK_EXHAUSTED", "交換用カードが不足しています。");
    }

    isResolvingRef.current = true;
    setIsAnimating(true);
    try {
      const rest = deckRef.current.slice();
      const finalHand: Card[] = [];
      for (let i = 0; i < HAND_SIZE; i++) {
        const current = handRef.current[i];
        if (heldRef.current[i] && current) {
          finalHand.push(current);
          continue;
        }
        const replacement = rest.shift();
        if (!replacement) {
          releaseResolving();
          return fail("DECK_EXHAUSTED", "交換用カードが不足しています。");
        }
        finalHand.push(replacement);
      }

      const coinCount = lockedCoinCountRef.current ?? coinsRef.current;
      const result = evaluatePayout({
        cards: finalHand,
        coinCount,
        betMin: rate.betMin,
        classicRoyalBonus,
      });
      const settledBet = lockedBetRef.current ?? rate.betMin * coinCount;
      economyRef.current.settle(buildVideoPokerResult(settledBet, result));

      setHand(finalHand);
      setDeck(rest);
      setLastResult(result);
      setWinningCardIndexes(getWinningCardIndexes(finalHand, result));
      setTableStack((stack) => stack + result.payout);
      setLockedBet(null);
      lockedCoinCountRef.current = null;
      setPhase("result");
      return succeed();
    } catch {
      releaseResolving();
      return fail("ECONOMY_FAILED", "精算処理に失敗しました。");
    }
  }, [classicRoyalBonus, fail, isAnimating, rate.betMin, releaseResolving, setDeck, setHand, setLockedBet, setPhase, setTableStack, succeed]);

  const rebuy = useCallback(
    (newTableStack: number): ActionResult => {
      if (isAnimating || isResolvingRef.current) return fail("ANIMATING", "演出中です。");
      if (phaseRef.current === "draw") return fail("INVALID_PHASE", "ハンド中はREBUYできません。");
      if (economyRef.current.chips < rate.buyInMin) {
        onInsufficient();
        return fail("INSUFFICIENT_CHIPS", "チップが不足しています。");
      }
      const max = Math.min(rate.buyInMax, economyRef.current.chips);
      if (!Number.isFinite(newTableStack) || newTableStack < rate.buyInMin || newTableStack > max) {
        return fail("INVALID_BET", "REBUY額が不正です。");
      }
      setTableStack(newTableStack);
      if (phaseRef.current === "buyIn") setPhase("ready");
      return succeed();
    },
    [fail, isAnimating, onInsufficient, rate.buyInMax, rate.buyInMin, setPhase, setTableStack, succeed],
  );

  const clearResult = useCallback(() => {
    setLastResult(null);
    setWinningCardIndexes([]);
    if (phaseRef.current === "result") setPhase("ready");
  }, [setPhase]);

  return {
    hand,
    cards,
    held,
    heldIndexes,
    phase,
    lastResult,
    winningCardIndexes,
    coins,
    coinCount: coins,
    bet: currentBet,
    currentBet,
    lockedBet,
    tableStack,
    canDeal,
    canDraw,
    canChangeBet,
    canRebuy,
    isAnimating,
    actionError,
    handId,
    setCoins: setCoinCount,
    setCoinCount,
    betMax: maxBet,
    maxBet,
    deal,
    draw,
    toggleHold,
    rebuy,
    clearResult,
  };
}
