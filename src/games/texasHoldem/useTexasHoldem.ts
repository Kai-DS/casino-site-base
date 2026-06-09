import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { shuffledDeck, validatePokerDeck } from "@/games/shared/poker/deck";
import { buildHoldemGameResult, toHoldemRateConfig } from "./adapter";
import {
  applyActionLabel,
  calculateActionMetrics,
  calculateAvailableActions,
  getHandContributionCap,
  isBettingRoundComplete,
  isContender,
  nextActionSeatIndex,
  nextOccupiedSeatIndex,
  placeToPot,
  resetOtherActivePlayersHasActed,
  setSeat,
  updateSeatByIndex,
  validateAllIn,
} from "./logic/betting";
import {
  applySettlementsToSeats,
  buildFoldResult,
  buildShowdownResult,
} from "./logic/pot";
import { chooseCpuAction } from "./logic/cpuStrategy";
import { evaluateShowdown } from "./logic/showdown";
import type {
  ActionResult,
  AnimationEvent,
  AvailableActions,
  Card,
  HoldemActionError,
  HoldemActionKind,
  HoldemAnimationPhase,
  HoldemPhase,
  HoldemResult,
  HoldemSeat,
  Pot,
  UseTexasHoldemOptions,
  UseTexasHoldemReturn,
} from "./types";

type PendingAfterAnimation = "preflop" | "flop" | "turn" | "river" | "result" | "cpuAction" | null;

interface HoldemState {
  phase: HoldemPhase;
  animationPhase: HoldemAnimationPhase;
  seats: HoldemSeat[];
  playerSeatIndex: number | null;
  dealerButtonIndex: number | null;
  smallBlindIndex: number | null;
  bigBlindIndex: number | null;
  currentTurnSeatIndex: number | null;
  deck: Card[];
  communityCards: Card[];
  pot: Pot;
  currentBet: number;
  minRaise: number;
  lastResult: HoldemResult | null;
  actionError: HoldemActionError | null;
  animationEvents: AnimationEvent[];
  pendingAfterAnimation: PendingAfterAnimation;
  handId: number;
}

type ReducerAction = { type: "replace"; state: HoldemState };

const CPU_STYLES: readonly HoldemSeat["style"][] = [
  "tightPassive",
  "tightAggressive",
  "loosePassive",
  "looseAggressive",
];

const DISABLED_ACTIONS: AvailableActions = {
  fold: { enabled: false, reason: "INVALID_PHASE" },
  check: { enabled: false, reason: "INVALID_PHASE" },
  call: { enabled: false, reason: "INVALID_PHASE" },
  bet: { enabled: false, reason: "INVALID_PHASE" },
  raise: { enabled: false, reason: "INVALID_PHASE" },
  allIn: { enabled: false, reason: "INVALID_PHASE" },
};

const ANIMATING_ACTIONS: AvailableActions = {
  fold: { enabled: false, reason: "ANIMATING" },
  check: { enabled: false, reason: "ANIMATING" },
  call: { enabled: false, reason: "ANIMATING" },
  bet: { enabled: false, reason: "ANIMATING" },
  raise: { enabled: false, reason: "ANIMATING" },
  allIn: { enabled: false, reason: "ANIMATING" },
};

function reducer(_state: HoldemState, action: ReducerAction): HoldemState {
  return action.state;
}

function fail(reason: HoldemActionError, message: string): ActionResult {
  return { ok: false, reason, message };
}

function randomInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function makeInitialState(options: UseTexasHoldemOptions): HoldemState {
  const config = toHoldemRateConfig(options.rate);
  return {
    phase: options.economy.chips >= options.rate.buyInMin ? "buyIn" : "unseated",
    animationPhase: "idle",
    seats: [],
    playerSeatIndex: null,
    dealerButtonIndex: null,
    smallBlindIndex: null,
    bigBlindIndex: null,
    currentTurnSeatIndex: null,
    deck: [],
    communityCards: [],
    pot: { amount: 0 },
    currentBet: 0,
    minRaise: config.minRaise,
    lastResult: null,
    actionError: null,
    animationEvents: [],
    pendingAfterAnimation: null,
    handId: 0,
  };
}

function makeSeats(tableStack: number, rate: UseTexasHoldemOptions["rate"], rng: () => number): HoldemSeat[] {
  const seats: HoldemSeat[] = [
    {
      id: "player",
      name: "You",
      seatIndex: 0,
      isHuman: true,
      tableStack,
      holeCards: [],
      status: "active",
      streetContribution: 0,
      totalContribution: 0,
      hasActed: false,
    },
  ];

  for (let i = 1; i < 5; i++) {
    seats.push({
      id: `cpu-${i}`,
      name: `CPU ${i}`,
      seatIndex: i,
      isHuman: false,
      style: CPU_STYLES[i - 1],
      tableStack: randomInt(rate.buyInMin, rate.buyInMax, rng),
      holeCards: [],
      status: "active",
      streetContribution: 0,
      totalContribution: 0,
      hasActed: false,
    });
  }

  return seats;
}

function resetSeatForHand(seat: HoldemSeat, bigBlind: number, rate: UseTexasHoldemOptions["rate"], rng: () => number): HoldemSeat {
  const tableStack = !seat.isHuman && seat.tableStack < bigBlind
    ? randomInt(rate.buyInMin, rate.buyInMax, rng)
    : seat.tableStack;

  return {
    ...seat,
    tableStack,
    holeCards: [],
    streetContribution: 0,
    totalContribution: 0,
    hasActed: false,
    lastAction: undefined,
    status: tableStack >= bigBlind ? "active" : "sittingOut",
  };
}

function orderedSeatIndexesFrom(startSeatIndex: number, seats: readonly HoldemSeat[]): number[] {
  const indexes: number[] = [];
  for (let step = 0; step < seats.length; step++) {
    const seatIndex = (startSeatIndex + step) % seats.length;
    if (seats.some((seat) => seat.seatIndex === seatIndex && seat.status !== "busted")) {
      indexes.push(seatIndex);
    }
  }
  return indexes;
}

function bettingPhase(phase: HoldemPhase): phase is "preflop" | "flop" | "turn" | "river" {
  return phase === "preflop" || phase === "flop" || phase === "turn" || phase === "river";
}

function animationPhaseForBettingPhase(phase: "preflop" | "flop" | "turn" | "river"): HoldemAnimationPhase {
  return phase === "preflop" ? "playerActing" : "playerActing";
}

function dealingPhaseForStreet(street: "flop" | "turn" | "river"): HoldemPhase {
  if (street === "flop") return "dealingFlop";
  if (street === "turn") return "dealingTurn";
  return "dealingRiver";
}

function animationPhaseForStreet(street: "flop" | "turn" | "river"): HoldemAnimationPhase {
  if (street === "flop") return "dealingFlop";
  if (street === "turn") return "dealingTurn";
  return "dealingRiver";
}

function resetSeatsForNewStreet(seats: readonly HoldemSeat[]): HoldemSeat[] {
  return seats.map((seat) => ({
    ...seat,
    streetContribution: 0,
    hasActed: seat.status !== "active",
  }));
}

function prependAnimationEvents(state: HoldemState, events: AnimationEvent[]): HoldemState {
  return { ...state, animationEvents: [...events, ...state.animationEvents] };
}

export function useTexasHoldem(options: UseTexasHoldemOptions): UseTexasHoldemReturn {
  const { rate } = options;
  const config = useMemo(() => toHoldemRateConfig(rate), [rate]);
  const rngRef = useRef(options.rng ?? Math.random);
  rngRef.current = options.rng ?? rngRef.current;
  const economyRef = useRef(options.economy);
  economyRef.current = options.economy;
  const deckProviderRef = useRef(options.deckProvider);
  deckProviderRef.current = options.deckProvider;
  const animationEnabledRef = useRef(options.animationEnabled !== false);
  animationEnabledRef.current = options.animationEnabled !== false;
  const eventSeqRef = useRef(0);
  const isResolvingRef = useRef(false);

  const [state, baseDispatch] = useReducer(reducer, options, makeInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const setState = useCallback((next: HoldemState) => {
    stateRef.current = next;
    baseDispatch({ type: "replace", state: next });
  }, []);

  const nextEventId = useCallback((type: AnimationEvent["type"]) => {
    eventSeqRef.current += 1;
    return `holdem-${stateRef.current.handId}-${eventSeqRef.current}-${type}`;
  }, []);

  const locked = useCallback(() => (
    isResolvingRef.current ||
    (animationEnabledRef.current && stateRef.current.animationEvents.length > 0)
  ), []);

  const buyIn = useCallback((amount: number): ActionResult => {
    if (locked()) return fail("ANIMATING", "演出中です。");
    const current = stateRef.current;
    if (current.phase !== "buyIn" && current.phase !== "unseated") {
      return fail("INVALID_PHASE", "現在は着席できません。");
    }
    if (economyRef.current.chips < rate.buyInMin) {
      return fail("INSUFFICIENT_CHIPS", "チップが不足しています。");
    }
    const max = Math.min(rate.buyInMax, economyRef.current.chips);
    if (!Number.isFinite(amount) || amount < rate.buyInMin || amount > max) {
      return fail("INVALID_BET", "持ち込み額が不正です。");
    }

    setState({
      ...current,
      phase: "waitingHand",
      animationPhase: "idle",
      seats: makeSeats(amount, rate, rngRef.current),
      playerSeatIndex: 0,
      actionError: null,
      lastResult: null,
    });
    return { ok: true };
  }, [locked, rate, setState]);

  const startHand = useCallback((): ActionResult => {
    if (locked()) return fail("ANIMATING", "演出中です。");
    const current = stateRef.current;
    if (current.phase !== "waitingHand" && current.phase !== "result") {
      return fail("INVALID_PHASE", "現在ハンドを開始できません。");
    }
    const player = current.seats.find((seat) => seat.isHuman);
    if (!player) return fail("NOT_SEATED", "着席していません。");
    if (player.tableStack < config.bigBlind || economyRef.current.chips < config.bigBlind) {
      return fail("REBUY_REQUIRED", "ハンド開始にはBig Blind以上のチップが必要です。");
    }

    const providedDeck = deckProviderRef.current ? deckProviderRef.current() : shuffledDeck(rngRef.current);
    const validated = validatePokerDeck(providedDeck, 15);
    if (!validated.ok) return fail(validated.reason, validated.message);

    isResolvingRef.current = true;
    const handId = current.handId + 1;
    let seats = current.seats.map((seat) => resetSeatForHand(seat, config.bigBlind, rate, rngRef.current));
    const initialButton = current.dealerButtonIndex === null
      ? (deckProviderRef.current ? 0 : randomInt(0, seats.length - 1, rngRef.current))
      : nextOccupiedSeatIndex(seats, current.dealerButtonIndex);
    const dealerButtonIndex = initialButton ?? 0;
    const smallBlindIndex = nextOccupiedSeatIndex(seats, dealerButtonIndex);
    const bigBlindIndex = smallBlindIndex === null ? null : nextOccupiedSeatIndex(seats, smallBlindIndex);
    if (smallBlindIndex === null || bigBlindIndex === null) {
      isResolvingRef.current = false;
      return fail("NOT_SEATED", "ブラインドを設定できる席がありません。");
    }

    let pot: Pot = { amount: 0 };
    const events: AnimationEvent[] = [];
    const postBlind = (seatIndex: number, amount: number): ActionResult => {
      const blindSeat = seats.find((seat) => seat.seatIndex === seatIndex);
      if (!blindSeat) return fail("NOT_SEATED", "ブラインド席がありません。");
      const placed = placeToPot({
        seats,
        pot,
        playerId: blindSeat.id,
        amount,
        economy: economyRef.current,
      });
      if (!placed.ok) return placed;
      seats = placed.seats;
      pot = placed.pot;
      events.push({ id: nextEventId("POST_BLIND"), type: "POST_BLIND", seat: seatIndex, amount });
      return { ok: true };
    };

    const smallBlind = postBlind(smallBlindIndex, config.smallBlind);
    if (!smallBlind.ok) {
      isResolvingRef.current = false;
      return smallBlind;
    }
    const bigBlind = postBlind(bigBlindIndex, config.bigBlind);
    if (!bigBlind.ok) {
      isResolvingRef.current = false;
      return bigBlind;
    }

    let deck = validated.deck.slice();
    const dealOrder = orderedSeatIndexesFrom(smallBlindIndex, seats);
    for (let cardIndex = 0; cardIndex < 2; cardIndex++) {
      for (const seatIndex of dealOrder) {
        const card = deck.shift();
        if (!card) {
          isResolvingRef.current = false;
          return fail("DECK_EXHAUSTED", "配布するカードが不足しています。");
        }
        seats = updateSeatByIndex(seats, seatIndex, (seat) => ({
          ...seat,
          holeCards: [...seat.holeCards, card],
        }));
        const seat = seats.find((candidate) => candidate.seatIndex === seatIndex);
        events.push({
          id: nextEventId("DEAL_HOLE"),
          type: "DEAL_HOLE",
          seat: seatIndex,
          cardIndex: cardIndex as 0 | 1,
          faceUp: Boolean(seat?.isHuman),
        });
      }
    }

    const currentTurnSeatIndex = nextActionSeatIndex(seats, bigBlindIndex);
    const queuedEvents = animationEnabledRef.current ? events : [];
    setState({
      ...current,
      phase: animationEnabledRef.current ? "postingBlinds" : "preflop",
      animationPhase: animationEnabledRef.current ? "postingBlinds" : "playerActing",
      seats,
      dealerButtonIndex,
      smallBlindIndex,
      bigBlindIndex,
      currentTurnSeatIndex,
      deck,
      communityCards: [],
      pot,
      currentBet: config.bigBlind,
      minRaise: config.minRaise,
      lastResult: null,
      actionError: null,
      animationEvents: queuedEvents,
      pendingAfterAnimation: queuedEvents.length > 0 ? "preflop" : null,
      handId,
    });
    isResolvingRef.current = false;
    return { ok: true };
  }, [config.bigBlind, config.minRaise, config.smallBlind, locked, nextEventId, rate, setState]);

  const settlePlayerResult = useCallback((result: HoldemResult) => {
    if (result.settlements.some((settlement) => settlement.isHuman)) {
      economyRef.current.settle(buildHoldemGameResult(result));
    }
  }, []);

  const finishFoldHand = useCallback((current: HoldemState, seats: HoldemSeat[]): HoldemState => {
    const winner = seats.find(isContender);
    if (!winner) return current;
    const result = buildFoldResult({
      handId: current.handId,
      seats,
      winnerSeatIndex: winner.seatIndex,
      pot: current.pot,
      dealerButtonIndex: current.dealerButtonIndex,
    });
    settlePlayerResult(result);

    const events: AnimationEvent[] = [
      {
        id: nextEventId("AWARD_POT"),
        type: "AWARD_POT",
        seat: winner.seatIndex,
        amount: current.pot.amount,
        isSplit: false,
      },
      {
        id: nextEventId("RESULT_BANNER"),
        type: "RESULT_BANNER",
        winners: [winner.seatIndex],
        category: "fold",
      },
    ];
    const queuedEvents = animationEnabledRef.current ? events : [];
    return {
      ...current,
      phase: queuedEvents.length > 0 ? "settling" : "result",
      animationPhase: queuedEvents.length > 0 ? "settlingPot" : "resultBanner",
      seats: applySettlementsToSeats(seats, result.settlements),
      pot: { amount: 0 },
      currentTurnSeatIndex: null,
      lastResult: result,
      animationEvents: queuedEvents,
      pendingAfterAnimation: queuedEvents.length > 0 ? "result" : null,
    };
  }, [nextEventId, settlePlayerResult]);

  const buildShowdownEvents = useCallback((
    seats: readonly HoldemSeat[],
    result: HoldemResult,
    revealEvents: readonly AnimationEvent[] = [],
  ): AnimationEvent[] => {
    const cpuRevealEvents = seats
      .filter((seat) => !seat.isHuman && isContender(seat))
      .map((seat): AnimationEvent => ({ id: nextEventId("FLIP_HOLE"), type: "FLIP_HOLE", seat: seat.seatIndex }));
    const highlightEvents = result.showdownHands
      .filter((hand) => result.winners.some((winner) => winner.seatIndex === hand.seatIndex))
      .map((hand): AnimationEvent => ({
        id: nextEventId("HIGHLIGHT_BEST"),
        type: "HIGHLIGHT_BEST",
        seat: hand.seatIndex,
        cards: hand.bestHand.cards,
      }));
    const awardEvents = result.winners.map((winner): AnimationEvent => ({
      id: nextEventId("AWARD_POT"),
      type: "AWARD_POT",
      seat: winner.seatIndex,
      amount: winner.wonAmount,
      isSplit: result.winners.length > 1,
    }));

    return [
      ...revealEvents,
      ...cpuRevealEvents,
      ...highlightEvents,
      ...awardEvents,
      {
        id: nextEventId("RESULT_BANNER"),
        type: "RESULT_BANNER",
        winners: result.winners.map((winner) => winner.seatIndex),
        category: result.winningCategory,
      },
    ];
  }, [nextEventId]);

  const resolveShowdown = useCallback((
    current: HoldemState,
    communityCards: Card[],
    deck: Card[],
    revealEvents: readonly AnimationEvent[] = [],
  ): HoldemState => {
    try {
      const showdown = evaluateShowdown(current.seats, communityCards);
      const result = buildShowdownResult({
        handId: current.handId,
        seats: current.seats,
        winnerSeatIndexes: showdown.winnerSeatIndexes,
        showdownHands: showdown.showdownHands,
        pot: current.pot,
        dealerButtonIndex: current.dealerButtonIndex,
      });
      settlePlayerResult(result);

      const events = buildShowdownEvents(current.seats, result, revealEvents);
      const queuedEvents = animationEnabledRef.current ? events : [];
      return {
        ...current,
        phase: queuedEvents.length > 0 ? "showdown" : "result",
        animationPhase: queuedEvents.length > 0 ? "showdownReveal" : "resultBanner",
        seats: applySettlementsToSeats(current.seats, result.settlements),
        currentTurnSeatIndex: null,
        communityCards,
        deck,
        pot: { amount: 0 },
        lastResult: result,
        animationEvents: queuedEvents,
        pendingAfterAnimation: queuedEvents.length > 0 ? "result" : null,
      };
    } catch {
      return { ...current, actionError: "DUPLICATE_CARD" };
    }
  }, [buildShowdownEvents, settlePlayerResult]);

  const drawMissingCommunityForShowdown = useCallback((current: HoldemState): HoldemState => {
    const deck = current.deck.slice();
    const communityCards = current.communityCards.slice();
    const revealEvents: AnimationEvent[] = [];

    if (communityCards.length === 0) {
      const flop = deck.splice(0, 3) as [Card, Card, Card];
      if (flop.length < 3) return { ...current, actionError: "DECK_EXHAUSTED" };
      communityCards.push(...flop);
      revealEvents.push({ id: nextEventId("REVEAL_FLOP"), type: "REVEAL_FLOP", cards: flop });
    }
    if (communityCards.length === 3) {
      const turn = deck.shift();
      if (!turn) return { ...current, actionError: "DECK_EXHAUSTED" };
      communityCards.push(turn);
      revealEvents.push({ id: nextEventId("REVEAL_TURN"), type: "REVEAL_TURN", card: turn });
    }
    if (communityCards.length === 4) {
      const river = deck.shift();
      if (!river) return { ...current, actionError: "DECK_EXHAUSTED" };
      communityCards.push(river);
      revealEvents.push({ id: nextEventId("REVEAL_RIVER"), type: "REVEAL_RIVER", card: river });
    }

    return resolveShowdown(current, communityCards, deck, revealEvents);
  }, [nextEventId, resolveShowdown]);

  const dealNextStreet = useCallback((current: HoldemState, street: "flop" | "turn" | "river"): HoldemState => {
    const deck = current.deck.slice();
    const communityCards = current.communityCards.slice();
    let event: AnimationEvent;

    if (street === "flop") {
      const flop = deck.splice(0, 3) as [Card, Card, Card];
      if (flop.length < 3) return { ...current, actionError: "DECK_EXHAUSTED" };
      communityCards.push(...flop);
      event = { id: nextEventId("REVEAL_FLOP"), type: "REVEAL_FLOP", cards: flop };
    } else {
      const card = deck.shift();
      if (!card) return { ...current, actionError: "DECK_EXHAUSTED" };
      communityCards.push(card);
      event = street === "turn"
        ? { id: nextEventId("REVEAL_TURN"), type: "REVEAL_TURN", card }
        : { id: nextEventId("REVEAL_RIVER"), type: "REVEAL_RIVER", card };
    }

    const seats = resetSeatsForNewStreet(current.seats);
    const firstSeatIndex = current.dealerButtonIndex === null
      ? null
      : nextActionSeatIndex(seats, current.dealerButtonIndex);
    if (firstSeatIndex === null) {
      return resolveShowdown({ ...current, seats, communityCards, deck }, communityCards, deck, [event]);
    }

    const queuedEvents = animationEnabledRef.current ? [event] : [];
    return {
      ...current,
      phase: queuedEvents.length > 0 ? dealingPhaseForStreet(street) : street,
      animationPhase: queuedEvents.length > 0 ? animationPhaseForStreet(street) : animationPhaseForBettingPhase(street),
      seats,
      currentBet: 0,
      currentTurnSeatIndex: firstSeatIndex,
      communityCards,
      deck,
      animationEvents: queuedEvents,
      pendingAfterAnimation: queuedEvents.length > 0 ? street : null,
    };
  }, [nextEventId, resolveShowdown]);

  const advanceAfterAction = useCallback((current: HoldemState, seats: HoldemSeat[], actorSeatIndex: number): HoldemState => {
    const contenders = seats.filter(isContender);
    if (contenders.length === 1) return finishFoldHand(current, seats);
    const actedCurrent = { ...current, seats };
    if (contenders.every((seat) => seat.status === "allIn")) {
      return drawMissingCommunityForShowdown(actedCurrent);
    }
    if (isBettingRoundComplete(seats, current.currentBet)) {
      if (current.phase === "preflop") return dealNextStreet(actedCurrent, "flop");
      if (current.phase === "flop") return dealNextStreet(actedCurrent, "turn");
      if (current.phase === "turn") return dealNextStreet(actedCurrent, "river");
      if (current.phase === "river") return resolveShowdown(actedCurrent, current.communityCards, current.deck);
    }

    return {
      ...current,
      seats,
      currentTurnSeatIndex: nextActionSeatIndex(seats, actorSeatIndex),
    };
  }, [dealNextStreet, drawMissingCommunityForShowdown, finishFoldHand, resolveShowdown]);

  const emitActionEvents = useCallback((seat: HoldemSeat, action: HoldemActionKind, amount: number, potAfter?: number): AnimationEvent[] => {
    const events: AnimationEvent[] = [
      { id: nextEventId("PLAYER_ACTION_LABEL"), type: "PLAYER_ACTION_LABEL", seat: seat.seatIndex, action, amount: amount || undefined },
    ];
    if (amount > 0 && potAfter !== undefined) {
      events.push({ id: nextEventId("CHIP_TO_POT"), type: "CHIP_TO_POT", seat: seat.seatIndex, amount, potAfter });
    }
    return animationEnabledRef.current ? events : [];
  }, [nextEventId]);

  const resolveCpuAction = useCallback((current: HoldemState): HoldemState => {
    const seat = current.currentTurnSeatIndex === null
      ? null
      : current.seats.find((candidate) => candidate.seatIndex === current.currentTurnSeatIndex) ?? null;
    if (!seat || seat.isHuman || seat.status !== "active") return current;

    const decision = chooseCpuAction({ seat, seats: current.seats, currentBet: current.currentBet, phase: current.phase });
    if (decision.action === "check") {
      const checked = applyActionLabel(seat, "check");
      const seats = setSeat(current.seats, checked);
      return prependAnimationEvents(
        advanceAfterAction(current, seats, checked.seatIndex),
        emitActionEvents(checked, "check", 0),
      );
    }

    if (decision.action === "fold") {
      const folded = applyActionLabel({ ...seat, status: "folded" }, "fold");
      const seats = setSeat(current.seats, folded);
      return prependAnimationEvents(
        advanceAfterAction(current, seats, folded.seatIndex),
        emitActionEvents(folded, "fold", 0),
      );
    }

    const placed = placeToPot({
      seats: current.seats,
      pot: current.pot,
      playerId: seat.id,
      amount: decision.amount,
      economy: economyRef.current,
    });

    if (placed.ok) {
      const called = applyActionLabel(placed.seat, "call");
      const seats = setSeat(placed.seats, called);
      return prependAnimationEvents(
        advanceAfterAction({ ...current, pot: placed.pot }, seats, called.seatIndex),
        emitActionEvents(called, "call", decision.amount, placed.pot.amount),
      );
    }

    const folded = applyActionLabel({ ...seat, status: "folded" }, "fold");
    const seats = setSeat(current.seats, folded);
    return prependAnimationEvents(
      advanceAfterAction(current, seats, folded.seatIndex),
      emitActionEvents(folded, "fold", 0),
    );
  }, [advanceAfterAction, emitActionEvents]);

  useEffect(() => {
    const current = stateRef.current;
    if (isResolvingRef.current || current.animationEvents.length > 0 || !bettingPhase(current.phase)) return;
    const seat = current.currentTurnSeatIndex === null
      ? null
      : current.seats.find((candidate) => candidate.seatIndex === current.currentTurnSeatIndex) ?? null;
    if (!seat || seat.isHuman || seat.status !== "active") return;

    if (animationEnabledRef.current) {
      setState({
        ...current,
        animationPhase: "cpuThinking",
        animationEvents: [
          { id: nextEventId("CPU_THINKING"), type: "CPU_THINKING", seat: seat.seatIndex, ms: 300 },
        ],
        pendingAfterAnimation: "cpuAction",
      });
      return;
    }

    isResolvingRef.current = true;
    setState(resolveCpuAction(current));
    isResolvingRef.current = false;
  }, [nextEventId, resolveCpuAction, setState, state]);

  const guardPlayerAction = useCallback((current: HoldemState): HoldemSeat | ActionResult => {
    if (locked()) return fail("ANIMATING", "演出中です。");
    if (!bettingPhase(current.phase)) return fail("INVALID_PHASE", "現在は操作できません。");
    if (current.playerSeatIndex === null) return fail("NOT_SEATED", "着席していません。");
    if (current.currentTurnSeatIndex !== current.playerSeatIndex) {
      return fail("NOT_YOUR_TURN", "あなたのターンではありません。");
    }
    const player = current.seats.find((seat) => seat.seatIndex === current.playerSeatIndex);
    if (!player || player.status !== "active") return fail("NOT_SEATED", "操作できる席がありません。");
    return player;
  }, [locked]);

  const commitPlayerSeats = useCallback((current: HoldemState, seats: HoldemSeat[], events: AnimationEvent[]): ActionResult => {
    const player = seats.find((seat) => seat.seatIndex === current.playerSeatIndex);
    if (!player) return fail("NOT_SEATED", "着席していません。");
    const advanced = advanceAfterAction(current, seats, player.seatIndex);
    setState({
      ...advanced,
      actionError: null,
      animationEvents: [...events, ...advanced.animationEvents],
    });
    return { ok: true };
  }, [advanceAfterAction, setState]);

  const fold = useCallback((): ActionResult => {
    const current = stateRef.current;
    const guarded = guardPlayerAction(current);
    if ("ok" in guarded) return guarded;
    const folded = applyActionLabel({ ...guarded, status: "folded" }, "fold");
    const seats = setSeat(current.seats, folded);
    const next = finishFoldHand({ ...current, seats }, seats);
    setState({
      ...next,
      actionError: null,
      animationEvents: [...emitActionEvents(folded, "fold", 0), ...next.animationEvents],
    });
    return { ok: true };
  }, [emitActionEvents, finishFoldHand, guardPlayerAction, setState]);

  const check = useCallback((): ActionResult => {
    const current = stateRef.current;
    const guarded = guardPlayerAction(current);
    if ("ok" in guarded) return guarded;
    if (guarded.streetContribution !== current.currentBet) {
      return fail("INVALID_BET", "Checkできません。");
    }
    const checked = applyActionLabel(guarded, "check");
    const seats = setSeat(current.seats, checked);
    return commitPlayerSeats(current, seats, emitActionEvents(checked, "check", 0));
  }, [commitPlayerSeats, emitActionEvents, guardPlayerAction]);

  const call = useCallback((): ActionResult => {
    const current = stateRef.current;
    const guarded = guardPlayerAction(current);
    if ("ok" in guarded) return guarded;
    const amount = Math.max(0, current.currentBet - guarded.streetContribution);
    if (amount <= 0) return fail("INVALID_BET", "Call額がありません。");
    const placed = placeToPot({
      seats: current.seats,
      pot: current.pot,
      playerId: guarded.id,
      amount,
      economy: economyRef.current,
    });
    if (!placed.ok) return placed;
    const acted = applyActionLabel(placed.seat, "call");
    const seats = setSeat(placed.seats, acted);
    return commitPlayerSeats(
      { ...current, pot: placed.pot },
      seats,
      emitActionEvents(acted, "call", amount, placed.pot.amount),
    );
  }, [commitPlayerSeats, emitActionEvents, guardPlayerAction]);

  const bet = useCallback((amount: number): ActionResult => {
    const current = stateRef.current;
    const guarded = guardPlayerAction(current);
    if ("ok" in guarded) return guarded;
    if (current.currentBet !== 0 || !Number.isFinite(amount) || amount < config.bigBlind) {
      return fail("INVALID_BET", "Bet額が不正です。");
    }
    const placed = placeToPot({
      seats: current.seats,
      pot: current.pot,
      playerId: guarded.id,
      amount,
      economy: economyRef.current,
    });
    if (!placed.ok) return placed;
    const acted = applyActionLabel(placed.seat, "bet");
    const seats = resetOtherActivePlayersHasActed(setSeat(placed.seats, acted), acted.id);
    return commitPlayerSeats(
      { ...current, pot: placed.pot, currentBet: amount },
      seats,
      emitActionEvents(acted, "bet", amount, placed.pot.amount),
    );
  }, [commitPlayerSeats, config.bigBlind, emitActionEvents, guardPlayerAction]);

  const raiseTo = useCallback((amount: number): ActionResult => {
    const current = stateRef.current;
    const guarded = guardPlayerAction(current);
    if ("ok" in guarded) return guarded;
    const maxRaiseTo = guarded.streetContribution + Math.max(0, getHandContributionCap(current.seats) - guarded.totalContribution);
    if (
      current.currentBet <= 0 ||
      !Number.isFinite(amount) ||
      amount < current.currentBet + config.minRaise ||
      amount > maxRaiseTo
    ) {
      return fail("INVALID_BET", "Raise額が不正です。");
    }
    const contribution = amount - guarded.streetContribution;
    const placed = placeToPot({
      seats: current.seats,
      pot: current.pot,
      playerId: guarded.id,
      amount: contribution,
      economy: economyRef.current,
    });
    if (!placed.ok) return placed;
    const acted = applyActionLabel(placed.seat, "raise");
    const seats = resetOtherActivePlayersHasActed(setSeat(placed.seats, acted), acted.id);
    return commitPlayerSeats(
      { ...current, pot: placed.pot, currentBet: amount },
      seats,
      emitActionEvents(acted, "raise", contribution, placed.pot.amount),
    );
  }, [commitPlayerSeats, config.minRaise, emitActionEvents, guardPlayerAction]);

  const allIn = useCallback((): ActionResult => {
    const current = stateRef.current;
    const guarded = guardPlayerAction(current);
    if ("ok" in guarded) return guarded;
    const validation = validateAllIn(guarded, current.seats, current.currentBet, config.bigBlind, config.minRaise);
    if (!validation.ok) return validation;
    const amount = guarded.tableStack;
    const allInRaiseTo = guarded.streetContribution + amount;
    const placed = placeToPot({
      seats: current.seats,
      pot: current.pot,
      playerId: guarded.id,
      amount,
      economy: economyRef.current,
    });
    if (!placed.ok) return placed;
    const acted = applyActionLabel({ ...placed.seat, status: "allIn" }, "allIn");
    const isRaise = current.currentBet === 0 || allInRaiseTo >= current.currentBet + config.minRaise;
    const nextCurrentBet = isRaise ? allInRaiseTo : current.currentBet;
    const seats = isRaise
      ? resetOtherActivePlayersHasActed(setSeat(placed.seats, acted), acted.id)
      : setSeat(placed.seats, acted);
    return commitPlayerSeats(
      { ...current, pot: placed.pot, currentBet: nextCurrentBet },
      seats,
      emitActionEvents(acted, "allIn", amount, placed.pot.amount),
    );
  }, [commitPlayerSeats, config.bigBlind, config.minRaise, emitActionEvents, guardPlayerAction]);

  const rebuy = useCallback((newTableStack: number): ActionResult => {
    if (locked()) return fail("ANIMATING", "演出中です。");
    const current = stateRef.current;
    if (current.phase !== "waitingHand" && current.phase !== "result" && current.phase !== "buyIn") {
      return fail("INVALID_PHASE", "ハンド中はREBUYできません。");
    }
    if (economyRef.current.chips < rate.buyInMin) {
      return fail("INSUFFICIENT_CHIPS", "チップが不足しています。");
    }
    const max = Math.min(rate.buyInMax, economyRef.current.chips);
    if (!Number.isFinite(newTableStack) || newTableStack < rate.buyInMin || newTableStack > max) {
      return fail("INVALID_BET", "REBUY額が不正です。");
    }
    if (current.playerSeatIndex === null || current.seats.length === 0) return buyIn(newTableStack);
    const seats = updateSeatByIndex(current.seats, current.playerSeatIndex, (seat) => ({
      ...seat,
      tableStack: newTableStack,
      status: "active",
    }));
    setState({ ...current, phase: "waitingHand", seats, actionError: null });
    return { ok: true };
  }, [buyIn, locked, rate.buyInMax, rate.buyInMin, setState]);

  const exitTable = useCallback((): ActionResult => {
    if (locked()) return fail("ANIMATING", "演出中です。");
    setState({
      ...makeInitialState({ ...options, economy: economyRef.current }),
      phase: economyRef.current.chips >= rate.buyInMin ? "buyIn" : "unseated",
    });
    return { ok: true };
  }, [locked, options, rate.buyInMin, setState]);

  const clearResult = useCallback(() => {
    const current = stateRef.current;
    if (current.phase === "result") {
      setState({ ...current, phase: "waitingHand", lastResult: null, actionError: null });
      return;
    }
    setState({ ...current, lastResult: null, actionError: null });
  }, [setState]);

  const onAnimationEventComplete = useCallback((eventId: string) => {
    const current = stateRef.current;
    const [head, ...remaining] = current.animationEvents;
    if (!head || head.id !== eventId) return;
    if (remaining.length > 0) {
      setState({ ...current, animationEvents: remaining });
      return;
    }

    if (current.pendingAfterAnimation === "cpuAction") {
      setState(resolveCpuAction({
        ...current,
        animationEvents: [],
        pendingAfterAnimation: null,
      }));
      return;
    }

    const phase = current.pendingAfterAnimation === "preflop"
      ? "preflop"
      : current.pendingAfterAnimation === "flop"
        ? "flop"
        : current.pendingAfterAnimation === "turn"
          ? "turn"
          : current.pendingAfterAnimation === "river"
            ? "river"
            : current.pendingAfterAnimation === "result"
              ? "result"
              : current.phase;
    const animationPhase = bettingPhase(phase)
      ? animationPhaseForBettingPhase(phase)
      : phase === "result"
        ? "resultBanner"
        : "idle";
    setState({
      ...current,
      phase,
      animationPhase,
      animationEvents: [],
      pendingAfterAnimation: null,
    });
  }, [resolveCpuAction, setState]);

  const playerSeat = state.playerSeatIndex === null
    ? null
    : state.seats.find((seat) => seat.seatIndex === state.playerSeatIndex) ?? null;
  const metrics = calculateActionMetrics({
    seats: state.seats,
    playerSeatIndex: state.playerSeatIndex,
    currentTurnSeatIndex: state.currentTurnSeatIndex,
    currentBet: state.currentBet,
    bigBlind: config.bigBlind,
    minRaise: config.minRaise,
  });
  const isAnimating = animationEnabledRef.current && state.animationEvents.length > 0;
  const availableActions = useMemo(() => {
    if (isAnimating || isResolvingRef.current) return ANIMATING_ACTIONS;
    if (!bettingPhase(state.phase)) return DISABLED_ACTIONS;
    return calculateAvailableActions({
      seats: state.seats,
      playerSeatIndex: state.playerSeatIndex,
      currentTurnSeatIndex: state.currentTurnSeatIndex,
      currentBet: state.currentBet,
      bigBlind: config.bigBlind,
      minRaise: config.minRaise,
    });
  }, [
    config.bigBlind,
    config.minRaise,
    isAnimating,
    state.currentBet,
    state.currentTurnSeatIndex,
    state.phase,
    state.playerSeatIndex,
    state.seats,
  ]);

  return {
    phase: state.phase,
    animationPhase: state.animationPhase,
    rate,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    seats: state.seats,
    playerSeatIndex: state.playerSeatIndex,
    dealerButtonIndex: state.dealerButtonIndex,
    smallBlindIndex: state.smallBlindIndex,
    bigBlindIndex: state.bigBlindIndex,
    currentTurnSeatIndex: state.currentTurnSeatIndex,
    deckRemaining: state.deck.length,
    communityCards: state.communityCards,
    pot: state.pot,
    currentBet: state.currentBet,
    minRaise: state.minRaise,
    amountToCall: metrics.amountToCall,
    handContributionCap: metrics.handContributionCap,
    maxRaiseTo: metrics.maxRaiseTo,
    tableStack: playerSeat?.tableStack ?? 0,
    availableActions,
    animationEvents: state.animationEvents,
    lastResult: state.lastResult,
    actionError: state.actionError,
    isAnimating,
    isResolving: isResolvingRef.current,
    buyIn,
    startHand,
    fold,
    check,
    call,
    bet,
    raiseTo,
    allIn,
    rebuy,
    exitTable,
    clearResult,
    onAnimationEventComplete,
  };
}

export type { UseTexasHoldemReturn };
