import { POSITION_LIST, POSITION_TABLE } from "../constants/positions";
import type {
  ActionAvailability,
  ActionResult,
  AvailableActions,
  BetPosition,
  PlacedBet,
  PositionId,
  RouletteActionError,
  RoulettePhase,
} from "../types";

export type PlacementAmount = {
  positionId: PositionId;
  amount: number;
};

export type BetValidationContext = {
  phase: RoulettePhase;
  isAnimating: boolean;
  bets: readonly PlacedBet[];
  stagedTotal: number;
  chips: number;
  maxBetPerPosition: number;
  maxTotalBet: number;
  positions?: Readonly<Record<PositionId, BetPosition>>;
};

export type AvailabilityContext = BetValidationContext & {
  selectedChip: number;
  minTotalBet: number;
  lastBets: readonly PlacedBet[] | null;
};

export const DISABLED_ACTIONS: AvailableActions = Object.freeze({
  placeChip: Object.freeze({ enabled: false, reason: "INVALID_PHASE" }),
  undo: Object.freeze({ enabled: false, reason: "INVALID_PHASE" }),
  clear: Object.freeze({ enabled: false, reason: "INVALID_PHASE" }),
  spin: Object.freeze({ enabled: false, reason: "INVALID_PHASE" }),
  rebet: Object.freeze({ enabled: false, reason: "INVALID_PHASE" }),
  newBets: Object.freeze({ enabled: false, reason: "INVALID_PHASE" }),
});

export const ANIMATING_ACTIONS: AvailableActions = Object.freeze({
  placeChip: Object.freeze({ enabled: false, reason: "ANIMATING" }),
  undo: Object.freeze({ enabled: false, reason: "ANIMATING" }),
  clear: Object.freeze({ enabled: false, reason: "ANIMATING" }),
  spin: Object.freeze({ enabled: false, reason: "ANIMATING" }),
  rebet: Object.freeze({ enabled: false, reason: "ANIMATING" }),
  newBets: Object.freeze({ enabled: false, reason: "ANIMATING" }),
});

export function fail(reason: RouletteActionError, message: string): ActionResult {
  return { ok: false, reason, message };
}

export function totalBetAmount(bets: readonly PlacedBet[]): number {
  return bets.reduce((sum, bet) => sum + bet.amount, 0);
}

export function calculatePositionTotals(bets: readonly PlacedBet[]): Record<PositionId, number> {
  const totals: Record<PositionId, number> = {};
  for (const bet of bets) {
    totals[bet.positionId] = (totals[bet.positionId] ?? 0) + bet.amount;
  }
  return totals;
}

function addByPosition(components: readonly PlacementAmount[]): Record<PositionId, number> {
  const totals: Record<PositionId, number> = {};
  for (const component of components) {
    totals[component.positionId] = (totals[component.positionId] ?? 0) + component.amount;
  }
  return totals;
}

export function validatePlacementAmounts(
  context: BetValidationContext,
  components: readonly PlacementAmount[],
): ActionResult {
  const positions = context.positions ?? POSITION_TABLE;
  if (context.phase !== "betting") return fail("INVALID_PHASE", "Betting is not open.");
  if (context.isAnimating) return fail("ANIMATING", "Animation is in progress.");
  for (const component of components) {
    if (!positions[component.positionId]) {
      return fail("INVALID_POSITION", "Unknown roulette bet position.");
    }
  }

  const cost = components.reduce((sum, component) => sum + component.amount, 0);
  if (cost > context.chips - context.stagedTotal) {
    return fail("INSUFFICIENT_FUNDS", "Not enough chips for this bet.");
  }

  const existingTotals = calculatePositionTotals(context.bets);
  const addedTotals = addByPosition(components);
  for (const [positionId, added] of Object.entries(addedTotals)) {
    if ((existingTotals[positionId] ?? 0) + added > context.maxBetPerPosition) {
      return fail("POSITION_LIMIT", "This position is at its table limit.");
    }
  }

  if (context.stagedTotal + cost > context.maxTotalBet) {
    return fail("TABLE_LIMIT", "This spin is at its table limit.");
  }

  return { ok: true };
}

export function validatePlaceChip(
  context: BetValidationContext,
  positionId: PositionId,
  chipValue: number,
): ActionResult {
  return validatePlacementAmounts(context, [{ positionId, amount: chipValue }]);
}

export function cappedPositionIds(
  bets: readonly PlacedBet[],
  chipValue: number,
  maxBetPerPosition: number,
  positions: readonly BetPosition[] = POSITION_LIST,
): readonly PositionId[] {
  const totals = calculatePositionTotals(bets);
  return positions
    .filter((position) => (totals[position.id] ?? 0) + chipValue > maxBetPerPosition)
    .map((position) => position.id);
}

function availability(result: ActionResult, amount?: number): ActionAvailability {
  if (result.ok) return amount === undefined ? { enabled: true } : { enabled: true, amount };
  return amount === undefined
    ? { enabled: false, reason: result.reason }
    : { enabled: false, reason: result.reason, amount };
}

function rebetComponents(lastBets: readonly PlacedBet[] | null): readonly PlacementAmount[] {
  return lastBets?.map((bet) => ({ positionId: bet.positionId, amount: bet.amount })) ?? [];
}

function validateRebet(context: AvailabilityContext): ActionResult {
  if (context.phase !== "betting" && context.phase !== "result") {
    return fail("INVALID_PHASE", "Rebet is not available now.");
  }
  if (context.phase === "betting" && context.bets.length > 0) {
    return fail("INVALID_PHASE", "Clear the current bets before rebetting.");
  }
  if (!context.lastBets || context.lastBets.length === 0) {
    return fail("NO_LAST_BETS", "There are no previous bets to repeat.");
  }

  return validatePlacementAmounts(
    {
      ...context,
      phase: "betting",
      isAnimating: false,
      bets: [],
      stagedTotal: 0,
    },
    rebetComponents(context.lastBets),
  );
}

export function evaluateAvailableActions(context: AvailabilityContext): AvailableActions {
  if (context.isAnimating) return ANIMATING_ACTIONS;

  const placeChipResult = context.phase === "betting"
    ? (() => {
        if (context.selectedChip > context.chips - context.stagedTotal) {
          return fail("INSUFFICIENT_FUNDS", "Not enough chips for this bet.");
        }
        if (context.stagedTotal + context.selectedChip > context.maxTotalBet) {
          return fail("TABLE_LIMIT", "This spin is at its table limit.");
        }
        if (cappedPositionIds(context.bets, context.selectedChip, context.maxBetPerPosition).length === POSITION_LIST.length) {
          return fail("POSITION_LIMIT", "All positions are capped.");
        }
        return { ok: true } as const;
      })()
    : fail("INVALID_PHASE", "Betting is not open.");

  const undoResult = context.phase !== "betting"
    ? fail("INVALID_PHASE", "Undo is not available now.")
    : context.bets.length === 0
      ? fail("NO_BETS", "There are no bets to undo.")
      : ({ ok: true } as const);

  const spinResult = context.phase !== "betting"
    ? fail("INVALID_PHASE", "Spin is not available now.")
    : context.bets.length === 0
      ? fail("NO_BETS", "There are no bets to spin.")
      : context.stagedTotal < context.minTotalBet
        ? fail("BELOW_MIN_TOTAL", "Total bet is below table minimum.")
        : context.stagedTotal > context.chips
          ? fail("INSUFFICIENT_FUNDS", "Not enough chips to spin.")
          : ({ ok: true } as const);

  const rebetResult = validateRebet(context);
  const newBetsResult = context.phase === "result"
    ? ({ ok: true } as const)
    : fail("INVALID_PHASE", "New bets are only available after a result.");
  const rebetAmount = totalBetAmount(context.lastBets ?? []);

  return {
    placeChip: availability(placeChipResult, context.selectedChip),
    undo: availability(undoResult),
    clear: availability(undoResult),
    spin: availability(spinResult, context.stagedTotal),
    rebet: availability(rebetResult, rebetAmount),
    newBets: availability(newBetsResult),
  };
}
