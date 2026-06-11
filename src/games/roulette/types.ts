import type { CallBetId } from "./constants/callBets";
import type { PocketColor } from "./constants/wheel";
import type { RouletteConfig } from "./adapter";

export type PositionId = string; // Naming examples: "straight-17", "split-17-20", "dozen-2", "red"

export type BetType =
  | "straight" | "split" | "street" | "corner" | "sixLine" | "trio" | "firstFour"
  | "red" | "black" | "odd" | "even" | "low" | "high" | "dozen" | "column";

export type BetCategory = "inside" | "outside";

/** Static definition generated and frozen at module load. */
export interface BetPosition {
  id: PositionId;
  type: BetType;
  label: string;
  coveredNumbers: readonly number[];
  payout: number;
  category: BetCategory;
}

/** One runtime bet entry. Multiple entries can target the same position. */
export interface PlacedBet {
  betId: string;
  positionId: PositionId;
  amount: number;
  groupId?: string;
  origin: "table" | "racetrack";
}

export interface SpinResult {
  number: number;
  color: PocketColor;
  parity: "odd" | "even" | null;
  range: "low" | "high" | null;
  dozen: 1 | 2 | 3 | null;
  column: 1 | 2 | 3 | null;
}

export interface BetOutcome {
  betId: string;
  positionId: PositionId;
  amount: number;
  won: boolean;
  returned: number;
}

export interface SpinSettlement {
  result: SpinResult;
  outcomes: readonly BetOutcome[];
  totalBet: number;
  totalReturned: number;
  profit: number;
  winningBetIds: readonly string[];
  losingBetIds: readonly string[];
}

export type RoulettePhase = "idle" | "betting" | "spinning" | "settling" | "result";

export type RouletteActionError =
  | "ANIMATING"
  | "INVALID_PHASE"
  | "INSUFFICIENT_FUNDS"
  | "POSITION_LIMIT"
  | "TABLE_LIMIT"
  | "BELOW_MIN_TOTAL"
  | "NO_BETS"
  | "NO_LAST_BETS"
  | "INVALID_POSITION"
  | "ECONOMY_REJECTED";

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: RouletteActionError; message: string };

export interface ActionAvailability {
  enabled: boolean;
  reason?: RouletteActionError;
  amount?: number;
}

export interface AvailableActions {
  placeChip: ActionAvailability;
  undo: ActionAvailability;
  clear: ActionAvailability;
  spin: ActionAvailability;
  rebet: ActionAvailability;
  newBets: ActionAvailability;
}

export type AnimationEvent =
  | { id: string; type: "NO_MORE_BETS" }
  | { id: string; type: "SPIN_START" }
  | { id: string; type: "BALL_LAND"; result: SpinResult }
  | { id: string; type: "MARK_WINNER"; number: number }
  | { id: string; type: "COLLECT_LOSING"; betIds: readonly string[]; totalLost: number }
  | { id: string; type: "PAY_WINNING";
      payouts: ReadonlyArray<{ betId: string; amount: number }>; totalWon: number }
  | { id: string; type: "RESULT_BANNER"; result: SpinResult;
      totalBet: number; totalReturned: number; profit: number };

export interface RouletteState {
  phase: RoulettePhase;
  bets: readonly PlacedBet[];
  stagedTotal: number;
  lastBets: readonly PlacedBet[] | null;
  settlement: SpinSettlement | null;
  settled: boolean;
  history: readonly SpinResult[];
}

export interface UseRouletteReturn {
  state: RouletteState;
  config: RouletteConfig;
  availableActions: AvailableActions;
  cappedPositionIds: readonly PositionId[];
  positionTotals: Readonly<Record<PositionId, number>>;
  animationEvents: readonly AnimationEvent[];
  isAnimating: boolean;
  selectedChip: number;
  selectChip(value: number): void;
  placeChip(positionId: PositionId): ActionResult;
  placeCallBet(id: CallBetId): ActionResult;
  placeNeighbors(center: number, n: number): ActionResult;
  undo(): ActionResult;
  clearBets(): ActionResult;
  spin(): ActionResult;
  rebet(): ActionResult;
  newBets(): ActionResult;
  exitTable(): ActionResult;
  onAnimationEventComplete(eventId: string): void;
  flushPendingSettlement(): void;
}

export interface RouletteProviders {
  /** Test/sandbox hook for forced outcomes. Defaults to Math.floor(Math.random() * 37). */
  resultProvider?: () => number;
}
