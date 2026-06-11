import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Rate } from "@/types/casino";
import type { GameEconomy } from "@/games/shared/economy";
import { buildRouletteGameResult, toRouletteRateConfig } from "./adapter";
import { CALL_BET_DEFS, makeNeighborsBet } from "./constants/callBets";
import {
  ANIMATING_ACTIONS,
  calculatePositionTotals,
  cappedPositionIds as calculateCappedPositionIds,
  evaluateAvailableActions,
  fail,
  totalBetAmount,
  validatePlacementAmounts,
} from "./logic/bets";
import { resolveSpin } from "./logic/resolve";
import type {
  ActionResult,
  AnimationEvent,
  PlacedBet,
  PositionId,
  RouletteProviders,
  RouletteState,
  UseRouletteReturn,
} from "./types";

export interface UseRouletteOptions extends RouletteProviders {
  rate: Rate;
  economy: GameEconomy;
  animationEnabled?: boolean;
  providers?: RouletteProviders;
}

type BetOp = readonly string[];

type RouletteRuntimeState = RouletteState & {
  betOps: readonly BetOp[];
  animationEvents: readonly AnimationEvent[];
  resultRecorded: boolean;
};

type ReducerAction = { type: "replace"; state: RouletteRuntimeState };

function reducer(_state: RouletteRuntimeState, action: ReducerAction): RouletteRuntimeState {
  return action.state;
}

function makeInitialState(): RouletteRuntimeState {
  return {
    phase: "betting",
    bets: [],
    stagedTotal: 0,
    lastBets: null,
    settlement: null,
    settled: true,
    history: [],
    betOps: [],
    animationEvents: [],
    resultRecorded: false,
  };
}

function prependHistory(state: RouletteRuntimeState): RouletteRuntimeState {
  if (!state.settlement || state.resultRecorded) return state;
  return {
    ...state,
    history: [state.settlement.result, ...state.history].slice(0, 12),
    resultRecorded: true,
  };
}

function componentAmounts(
  components: ReadonlyArray<{ positionId: PositionId; chips: number }>,
  selectedChip: number,
) {
  return components.map((component) => ({
    positionId: component.positionId,
    amount: component.chips * selectedChip,
  }));
}

function publicStateOf(state: RouletteRuntimeState): RouletteState {
  return {
    phase: state.phase,
    bets: state.bets,
    stagedTotal: state.stagedTotal,
    lastBets: state.lastBets,
    settlement: state.settlement,
    settled: state.settled,
    history: state.history,
  };
}

export function useRoulette(options: UseRouletteOptions): UseRouletteReturn {
  const { economy, rate } = options;
  const config = useMemo(() => toRouletteRateConfig(rate), [rate]);
  const [selectedChip, setSelectedChip] = useState(config.chipDenoms[0] ?? rate.betMin);

  const economyRef = useRef(economy);
  economyRef.current = economy;
  const resultProviderRef = useRef<(() => number) | undefined>(options.providers?.resultProvider ?? options.resultProvider);
  resultProviderRef.current = options.providers?.resultProvider ?? options.resultProvider;
  const animationEnabledRef = useRef(options.animationEnabled !== false);
  animationEnabledRef.current = options.animationEnabled !== false;

  const betSeqRef = useRef(0);
  const groupSeqRef = useRef(0);
  const eventSeqRef = useRef(0);
  const spinSeqRef = useRef(0);

  const [state, baseDispatch] = useReducer(reducer, undefined, makeInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const setState = useCallback((next: RouletteRuntimeState) => {
    stateRef.current = next;
    baseDispatch({ type: "replace", state: next });
  }, []);

  const nextBetId = useCallback(() => {
    betSeqRef.current += 1;
    return `roulette-bet-${betSeqRef.current}`;
  }, []);

  const nextGroupId = useCallback((kind: string) => {
    groupSeqRef.current += 1;
    return `roulette-${kind}-${groupSeqRef.current}`;
  }, []);

  const nextEventId = useCallback((type: AnimationEvent["type"]) => {
    eventSeqRef.current += 1;
    return `roulette-spin-${spinSeqRef.current}-${eventSeqRef.current}-${type}`;
  }, []);

  const isLocked = useCallback(() => (
    animationEnabledRef.current && stateRef.current.animationEvents.length > 0
  ), []);

  const settleIfNeeded = useCallback((current: RouletteRuntimeState): RouletteRuntimeState => {
    if (!current.settlement || current.settled) return current;
    economyRef.current.settle(buildRouletteGameResult(current.settlement));
    return { ...current, settled: true };
  }, []);

  const flushPendingSettlement = useCallback(() => {
    const current = stateRef.current;
    if (!current.settlement || current.settled) return;
    const next = settleIfNeeded({
      ...prependHistory(current),
      phase: "result",
      animationEvents: [],
    });
    setState(next);
  }, [setState, settleIfNeeded]);

  const flushPendingSettlementForUnmount = useCallback(() => {
    const current = stateRef.current;
    if (!current.settlement || current.settled) return;
    const next = settleIfNeeded({
      ...prependHistory(current),
      phase: "result",
      animationEvents: [],
    });
    stateRef.current = next;
  }, [settleIfNeeded]);

  useEffect(() => flushPendingSettlementForUnmount, [flushPendingSettlementForUnmount]);

  const selectChip = useCallback((value: number) => {
    const phase = stateRef.current.phase;
    if (phase === "spinning" || phase === "settling") return;
    if (!config.chipDenoms.includes(value)) return;
    setSelectedChip(value);
  }, [config.chipDenoms]);

  const placeComponents = useCallback((
    components: ReadonlyArray<{ positionId: PositionId; chips: number }>,
    origin: PlacedBet["origin"],
    groupKind?: string,
  ): ActionResult => {
    if (isLocked()) return fail("ANIMATING", "Animation is in progress.");
    const current = stateRef.current;
    const amounts = componentAmounts(components, selectedChip);
    const result = validatePlacementAmounts(
      {
        phase: current.phase,
        isAnimating: false,
        bets: current.bets,
        stagedTotal: current.stagedTotal,
        chips: economyRef.current.chips,
        maxBetPerPosition: config.maxBetPerPosition,
        maxTotalBet: config.maxTotalBet,
      },
      amounts,
    );
    if (!result.ok) return result;

    const groupId = groupKind ? nextGroupId(groupKind) : undefined;
    const newBets = amounts.map((amount): PlacedBet => ({
      betId: nextBetId(),
      positionId: amount.positionId,
      amount: amount.amount,
      ...(groupId ? { groupId } : {}),
      origin,
    }));
    const newBetIds = newBets.map((bet) => bet.betId);
    setState({
      ...current,
      bets: [...current.bets, ...newBets],
      stagedTotal: current.stagedTotal + newBets.reduce((sum, bet) => sum + bet.amount, 0),
      betOps: [...current.betOps, newBetIds],
      settlement: null,
      settled: true,
      resultRecorded: false,
    });
    return { ok: true };
  }, [config.maxBetPerPosition, config.maxTotalBet, isLocked, nextBetId, nextGroupId, selectedChip, setState]);

  const placeChip = useCallback((positionId: PositionId): ActionResult => (
    placeComponents([{ positionId, chips: 1 }], "table")
  ), [placeComponents]);

  const placeCallBet = useCallback((id: keyof typeof CALL_BET_DEFS): ActionResult => {
    const def = CALL_BET_DEFS[id];
    if (!def) return fail("INVALID_POSITION", "Unknown call bet.");
    return placeComponents(def.components, "racetrack", id);
  }, [placeComponents]);

  const placeNeighbors = useCallback((center: number, n: number): ActionResult => {
    if (n < config.neighborRange.min || n > config.neighborRange.max) {
      return fail("INVALID_POSITION", "Neighbor range is outside table config.");
    }
    try {
      return placeComponents(makeNeighborsBet(center, n), "racetrack", "neighbors");
    } catch {
      return fail("INVALID_POSITION", "Unknown roulette neighbor center.");
    }
  }, [config.neighborRange.max, config.neighborRange.min, placeComponents]);

  const undo = useCallback((): ActionResult => {
    if (isLocked()) return fail("ANIMATING", "Animation is in progress.");
    const current = stateRef.current;
    if (current.phase !== "betting") return fail("INVALID_PHASE", "Undo is not available now.");
    const lastOp = current.betOps[current.betOps.length - 1];
    if (!lastOp) return fail("NO_BETS", "There are no bets to undo.");
    const removeIds = new Set(lastOp);
    const bets = current.bets.filter((bet) => !removeIds.has(bet.betId));
    setState({
      ...current,
      bets,
      stagedTotal: totalBetAmount(bets),
      betOps: current.betOps.slice(0, -1),
    });
    return { ok: true };
  }, [isLocked, setState]);

  const clearBets = useCallback((): ActionResult => {
    if (isLocked()) return fail("ANIMATING", "Animation is in progress.");
    const current = stateRef.current;
    if (current.phase !== "betting") return fail("INVALID_PHASE", "Clear is not available now.");
    if (current.bets.length === 0) return fail("NO_BETS", "There are no bets to clear.");
    setState({ ...current, bets: [], stagedTotal: 0, betOps: [] });
    return { ok: true };
  }, [isLocked, setState]);

  const buildEvents = useCallback((settlement: NonNullable<RouletteState["settlement"]>): readonly AnimationEvent[] => {
    const winningPayouts = settlement.outcomes
      .filter((outcome) => outcome.won)
      .map((outcome) => ({ betId: outcome.betId, amount: outcome.returned }));
    const events: AnimationEvent[] = [
      { id: nextEventId("NO_MORE_BETS"), type: "NO_MORE_BETS" },
      { id: nextEventId("SPIN_START"), type: "SPIN_START" },
      { id: nextEventId("BALL_LAND"), type: "BALL_LAND", result: settlement.result },
      { id: nextEventId("MARK_WINNER"), type: "MARK_WINNER", number: settlement.result.number },
    ];

    if (settlement.losingBetIds.length > 0) {
      const totalLost = settlement.outcomes
        .filter((outcome) => !outcome.won)
        .reduce((sum, outcome) => sum + outcome.amount, 0);
      events.push({
        id: nextEventId("COLLECT_LOSING"),
        type: "COLLECT_LOSING",
        betIds: settlement.losingBetIds,
        totalLost,
      });
    }

    if (winningPayouts.length > 0) {
      events.push({
        id: nextEventId("PAY_WINNING"),
        type: "PAY_WINNING",
        payouts: winningPayouts,
        totalWon: settlement.totalReturned,
      });
    }

    events.push({
      id: nextEventId("RESULT_BANNER"),
      type: "RESULT_BANNER",
      result: settlement.result,
      totalBet: settlement.totalBet,
      totalReturned: settlement.totalReturned,
      profit: settlement.profit,
    });
    return events;
  }, [nextEventId]);

  const spin = useCallback((): ActionResult => {
    if (isLocked()) return fail("ANIMATING", "Animation is in progress.");
    const current = stateRef.current;
    if (current.phase !== "betting") return fail("INVALID_PHASE", "Spin is not available now.");
    if (current.bets.length === 0) return fail("NO_BETS", "There are no bets to spin.");
    if (current.stagedTotal < config.minTotalBet) return fail("BELOW_MIN_TOTAL", "Total bet is below table minimum.");
    if (!economyRef.current.placeBet(current.stagedTotal)) {
      return fail("ECONOMY_REJECTED", "The casino economy rejected this bet.");
    }

    const winning = resultProviderRef.current?.() ?? Math.floor(Math.random() * 37);
    const settlement = resolveSpin(current.bets, winning);
    spinSeqRef.current += 1;
    eventSeqRef.current = 0;

    const base: RouletteRuntimeState = {
      ...current,
      phase: "spinning",
      lastBets: current.bets.map((bet) => ({ ...bet })),
      settlement,
      settled: false,
      resultRecorded: false,
      animationEvents: animationEnabledRef.current ? buildEvents(settlement) : [],
    };

    if (animationEnabledRef.current) {
      setState(base);
      return { ok: true };
    }

    const settling = prependHistory({ ...base, phase: "settling" });
    const immediate = settleIfNeeded({
      ...settling,
      phase: "result",
      animationEvents: [],
    });
    setState(immediate);
    return { ok: true };
  }, [buildEvents, config.minTotalBet, isLocked, setState, settleIfNeeded]);

  const cloneLastBets = useCallback((lastBets: readonly PlacedBet[]): PlacedBet[] => {
    const groupIds = new Map<string, string>();
    return lastBets.map((bet) => {
      const next: PlacedBet = {
        betId: nextBetId(),
        positionId: bet.positionId,
        amount: bet.amount,
        origin: bet.origin,
      };
      if (bet.groupId) {
        const existing = groupIds.get(bet.groupId);
        const groupId = existing ?? nextGroupId("rebet");
        groupIds.set(bet.groupId, groupId);
        next.groupId = groupId;
      }
      return next;
    });
  }, [nextBetId, nextGroupId]);

  const rebet = useCallback((): ActionResult => {
    if (isLocked()) return fail("ANIMATING", "Animation is in progress.");
    const current = stateRef.current;
    if (current.phase !== "betting" && current.phase !== "result") {
      return fail("INVALID_PHASE", "Rebet is not available now.");
    }
    if (current.phase === "betting" && current.bets.length > 0) {
      return fail("INVALID_PHASE", "Clear current bets before rebetting.");
    }
    if (!current.lastBets || current.lastBets.length === 0) {
      return fail("NO_LAST_BETS", "There are no previous bets to repeat.");
    }

    const validation = validatePlacementAmounts(
      {
        phase: "betting",
        isAnimating: false,
        bets: [],
        stagedTotal: 0,
        chips: economyRef.current.chips,
        maxBetPerPosition: config.maxBetPerPosition,
        maxTotalBet: config.maxTotalBet,
      },
      current.lastBets.map((bet) => ({ positionId: bet.positionId, amount: bet.amount })),
    );
    if (!validation.ok) return validation;

    const bets = cloneLastBets(current.lastBets);
    setState({
      ...current,
      phase: "betting",
      bets,
      stagedTotal: totalBetAmount(bets),
      betOps: [bets.map((bet) => bet.betId)],
      settlement: null,
      settled: true,
      animationEvents: [],
      resultRecorded: false,
    });
    return { ok: true };
  }, [cloneLastBets, config.maxBetPerPosition, config.maxTotalBet, isLocked, setState]);

  const newBets = useCallback((): ActionResult => {
    if (isLocked()) return fail("ANIMATING", "Animation is in progress.");
    const current = stateRef.current;
    if (current.phase !== "result") return fail("INVALID_PHASE", "New bets are only available after a result.");
    setState({
      ...current,
      phase: "betting",
      bets: [],
      stagedTotal: 0,
      betOps: [],
      settlement: null,
      settled: true,
      animationEvents: [],
      resultRecorded: false,
    });
    return { ok: true };
  }, [isLocked, setState]);

  const exitTable = useCallback((): ActionResult => {
    const current = stateRef.current;
    if (current.phase === "spinning" || current.phase === "settling") {
      return fail("INVALID_PHASE", "Cannot exit during an active spin.");
    }
    if (current.phase === "idle") return { ok: true };
    setState({
      ...current,
      phase: "idle",
      bets: [],
      stagedTotal: 0,
      betOps: [],
      settlement: null,
      settled: true,
      animationEvents: [],
      resultRecorded: false,
    });
    return { ok: true };
  }, [setState]);

  const onAnimationEventComplete = useCallback((eventId: string) => {
    const current = stateRef.current;
    const [head, ...remaining] = current.animationEvents;
    if (!head || head.id !== eventId) return;

    let next: RouletteRuntimeState = { ...current, animationEvents: remaining };
    if (head.type === "BALL_LAND") {
      next = prependHistory({ ...next, phase: "settling" });
    } else if (head.type === "COLLECT_LOSING") {
      if (!remaining.some((event) => event.type === "PAY_WINNING")) {
        next = settleIfNeeded(next);
      }
    } else if (head.type === "PAY_WINNING") {
      next = settleIfNeeded(next);
    } else if (head.type === "RESULT_BANNER") {
      next = { ...next, phase: "result" };
    }

    setState(next);
  }, [setState, settleIfNeeded]);

  const isAnimating = animationEnabledRef.current && state.animationEvents.length > 0;
  const positionTotals = useMemo(() => calculatePositionTotals(state.bets), [state.bets]);
  const cappedPositionIdList = useMemo(
    () => calculateCappedPositionIds(state.bets, selectedChip, config.maxBetPerPosition),
    [config.maxBetPerPosition, selectedChip, state.bets],
  );
  const availableActions = useMemo(() => {
    if (isAnimating) return ANIMATING_ACTIONS;
    return evaluateAvailableActions({
      phase: state.phase,
      isAnimating,
      bets: state.bets,
      stagedTotal: state.stagedTotal,
      chips: economy.chips,
      maxBetPerPosition: config.maxBetPerPosition,
      maxTotalBet: config.maxTotalBet,
      selectedChip,
      minTotalBet: config.minTotalBet,
      lastBets: state.lastBets,
    });
  }, [
    config.maxBetPerPosition,
    config.maxTotalBet,
    config.minTotalBet,
    economy.chips,
    isAnimating,
    selectedChip,
    state.bets,
    state.lastBets,
    state.phase,
    state.stagedTotal,
  ]);
  const publicState = useMemo(() => publicStateOf(state), [state]);

  return {
    state: publicState,
    config,
    availableActions,
    cappedPositionIds: cappedPositionIdList,
    positionTotals,
    animationEvents: state.animationEvents,
    isAnimating,
    selectedChip,
    selectChip,
    placeChip,
    placeCallBet,
    placeNeighbors,
    undo,
    clearBets,
    spin,
    rebet,
    newBets,
    exitTable,
    onAnimationEventComplete,
    flushPendingSettlement,
  };
}
