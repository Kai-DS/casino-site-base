import type { GameEconomy } from "@/games/shared/economy";
import type {
  ActionResult,
  AvailableActions,
  HoldemActionError,
  HoldemActionKind,
  HoldemSeat,
  Pot,
} from "../types";

export type BettingPhase = "preflop" | "flop" | "turn" | "river";

export interface PlaceToPotParams {
  seats: readonly HoldemSeat[];
  pot: Pot;
  playerId: string;
  amount: number;
  economy: GameEconomy;
}

export type PlaceToPotResult =
  | {
      ok: true;
      seats: HoldemSeat[];
      pot: Pot;
      seat: HoldemSeat;
      amount: number;
    }
  | {
      ok: false;
      reason: HoldemActionError;
      message: string;
    };

export interface ActionContext {
  seats: readonly HoldemSeat[];
  playerSeatIndex: number | null;
  currentTurnSeatIndex: number | null;
  currentBet: number;
  bigBlind: number;
  minRaise: number;
}

export interface ActionMetrics {
  amountToCall: number;
  handContributionCap: number;
  maxRaiseTo: number;
}

const OK: ActionResult = { ok: true };

export function ok(): ActionResult {
  return OK;
}

export function fail(reason: HoldemActionError, message: string): ActionResult {
  return { ok: false, reason, message };
}

export function isContender(seat: HoldemSeat): boolean {
  return seat.status === "active" || seat.status === "allIn";
}

export function isActionable(seat: HoldemSeat): boolean {
  return seat.status === "active" && seat.tableStack > 0;
}

export function getHandContributionCap(seats: readonly HoldemSeat[]): number {
  const contenders = seats.filter(isContender);
  if (contenders.length === 0) return 0;
  return Math.min(...contenders.map((seat) => seat.tableStack + seat.totalContribution));
}

export function normalizeSeatStatusAfterContribution(seat: HoldemSeat): HoldemSeat {
  if (seat.status === "active" && seat.tableStack === 0) {
    return { ...seat, status: "allIn", hasActed: true };
  }
  return seat;
}

export function amountToCallForSeat(seat: HoldemSeat, currentBet: number): number {
  return Math.max(0, currentBet - seat.streetContribution);
}

export function maxAdditionalForSeat(seat: HoldemSeat, seats: readonly HoldemSeat[]): number {
  return Math.max(0, getHandContributionCap(seats) - seat.totalContribution);
}

export function maxRaiseToForSeat(seat: HoldemSeat, seats: readonly HoldemSeat[]): number {
  return seat.streetContribution + maxAdditionalForSeat(seat, seats);
}

export function setSeat(seats: readonly HoldemSeat[], updatedSeat: HoldemSeat): HoldemSeat[] {
  return seats.map((seat) => (seat.id === updatedSeat.id ? updatedSeat : { ...seat }));
}

export function updateSeatByIndex(
  seats: readonly HoldemSeat[],
  seatIndex: number,
  update: (seat: HoldemSeat) => HoldemSeat,
): HoldemSeat[] {
  return seats.map((seat) => (seat.seatIndex === seatIndex ? update({ ...seat }) : { ...seat }));
}

export function resetOtherActivePlayersHasActed(
  seats: readonly HoldemSeat[],
  actorId: string,
): HoldemSeat[] {
  return seats.map((seat) => {
    if (seat.id === actorId || seat.status !== "active") return { ...seat };
    return { ...seat, hasActed: false };
  });
}

export function placeToPot(params: PlaceToPotParams): PlaceToPotResult {
  const { seats, pot, playerId, amount, economy } = params;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "INVALID_BET", message: "ベット額が不正です。" };
  }

  const player = seats.find((seat) => seat.id === playerId);
  if (!player) {
    return { ok: false, reason: "NOT_SEATED", message: "席情報がありません。" };
  }

  const cap = getHandContributionCap(seats);
  if (player.tableStack < amount) {
    return { ok: false, reason: "INSUFFICIENT_TABLE_STACK", message: "テーブル上のチップが不足しています。" };
  }
  if (player.isHuman && economy.chips < amount) {
    return { ok: false, reason: "INSUFFICIENT_CHIPS", message: "所持チップが不足しています。" };
  }
  if (player.totalContribution + amount > cap) {
    return {
      ok: false,
      reason: "SIDE_POT_NOT_SUPPORTED",
      message: "v1ではサイドポットが発生するベットはできません。",
    };
  }
  if (player.isHuman && !economy.placeBet(amount)) {
    return { ok: false, reason: "ECONOMY_FAILED", message: "チップ処理に失敗しました。" };
  }

  const contributed = normalizeSeatStatusAfterContribution({
    ...player,
    tableStack: player.tableStack - amount,
    streetContribution: player.streetContribution + amount,
    totalContribution: player.totalContribution + amount,
  });
  const nextSeats = setSeat(seats, contributed);

  return {
    ok: true,
    seats: nextSeats,
    pot: { amount: pot.amount + amount },
    seat: contributed,
    amount,
  };
}

export function findNextSeatIndex(
  seats: readonly HoldemSeat[],
  fromSeatIndex: number,
  include: (seat: HoldemSeat) => boolean,
): number | null {
  if (seats.length === 0) return null;
  for (let step = 1; step <= seats.length; step++) {
    const index = (fromSeatIndex + step) % seats.length;
    const seat = seats.find((candidate) => candidate.seatIndex === index);
    if (seat && include(seat)) return seat.seatIndex;
  }
  return null;
}

export function nextOccupiedSeatIndex(seats: readonly HoldemSeat[], fromSeatIndex: number): number | null {
  return findNextSeatIndex(seats, fromSeatIndex, (seat) => seat.status !== "busted");
}

export function nextActionSeatIndex(seats: readonly HoldemSeat[], fromSeatIndex: number): number | null {
  return findNextSeatIndex(seats, fromSeatIndex, isActionable);
}

export function isBettingRoundComplete(seats: readonly HoldemSeat[], currentBet: number): boolean {
  const contenders = seats.filter(isContender);
  const activeNeedAction = contenders.filter((seat) => seat.status === "active" && !seat.hasActed);
  const allMatchedOrAllIn = contenders.every(
    (seat) => seat.status === "allIn" || seat.streetContribution === currentBet,
  );
  return activeNeedAction.length === 0 && allMatchedOrAllIn;
}

export function calculateActionMetrics(context: ActionContext): ActionMetrics {
  const seat = context.playerSeatIndex === null
    ? null
    : context.seats.find((candidate) => candidate.seatIndex === context.playerSeatIndex) ?? null;
  if (!seat) {
    return { amountToCall: 0, handContributionCap: 0, maxRaiseTo: 0 };
  }

  return {
    amountToCall: amountToCallForSeat(seat, context.currentBet),
    handContributionCap: getHandContributionCap(context.seats),
    maxRaiseTo: maxRaiseToForSeat(seat, context.seats),
  };
}

function disabled(reason: HoldemActionError): { enabled: false; reason: HoldemActionError } {
  return { enabled: false, reason };
}

function enabled(): { enabled: true } {
  return { enabled: true };
}

export function validateAllIn(
  seat: HoldemSeat,
  seats: readonly HoldemSeat[],
  currentBet: number,
  bigBlind: number,
  minRaise: number,
): ActionResult {
  const allInAmount = seat.tableStack;
  if (allInAmount <= 0) return fail("INVALID_BET", "All-in額が不正です。");
  if (seat.totalContribution + allInAmount > getHandContributionCap(seats)) {
    return fail("SIDE_POT_NOT_SUPPORTED", "v1ではサイドポットが発生するAll-inはできません。");
  }

  if (currentBet === 0) {
    if (allInAmount < bigBlind) {
      return fail("SIDE_POT_NOT_SUPPORTED", "v1ではBig Blind未満のAll-in Betはできません。");
    }
    return OK;
  }

  const allInRaiseTo = seat.streetContribution + allInAmount;
  if (allInRaiseTo === currentBet || allInRaiseTo >= currentBet + minRaise) return OK;

  return fail("SIDE_POT_NOT_SUPPORTED", "v1では中途半端な額のAll-inはできません。");
}

export function calculateAvailableActions(context: ActionContext): AvailableActions {
  const blocked: AvailableActions = {
    fold: disabled("NOT_YOUR_TURN"),
    check: disabled("NOT_YOUR_TURN"),
    call: disabled("NOT_YOUR_TURN"),
    bet: disabled("NOT_YOUR_TURN"),
    raise: disabled("NOT_YOUR_TURN"),
    allIn: disabled("NOT_YOUR_TURN"),
  };
  if (context.playerSeatIndex === null || context.currentTurnSeatIndex !== context.playerSeatIndex) return blocked;

  const seat = context.seats.find((candidate) => candidate.seatIndex === context.playerSeatIndex);
  if (!seat || seat.status !== "active") {
    return {
      fold: disabled("NOT_SEATED"),
      check: disabled("NOT_SEATED"),
      call: disabled("NOT_SEATED"),
      bet: disabled("NOT_SEATED"),
      raise: disabled("NOT_SEATED"),
      allIn: disabled("NOT_SEATED"),
    };
  }

  const amountToCall = amountToCallForSeat(seat, context.currentBet);
  const cap = getHandContributionCap(context.seats);
  const maxRaiseTo = maxRaiseToForSeat(seat, context.seats);
  const allInResult = validateAllIn(seat, context.seats, context.currentBet, context.bigBlind, context.minRaise);

  const callReason = amountToCall <= 0
    ? "INVALID_PHASE"
    : seat.tableStack < amountToCall
      ? "INSUFFICIENT_TABLE_STACK"
      : seat.totalContribution + amountToCall > cap
        ? "SIDE_POT_NOT_SUPPORTED"
        : "INSUFFICIENT_TABLE_STACK";
  const betReason = context.currentBet !== 0
    ? "INVALID_PHASE"
    : seat.tableStack < context.bigBlind
      ? "INSUFFICIENT_TABLE_STACK"
      : seat.totalContribution + context.bigBlind > cap
        ? "SIDE_POT_NOT_SUPPORTED"
        : "INSUFFICIENT_TABLE_STACK";
  const raiseReason = context.currentBet === 0
    ? "INVALID_PHASE"
    : context.currentBet + context.minRaise > maxRaiseTo
      ? "SIDE_POT_NOT_SUPPORTED"
      : "INVALID_BET";

  return {
    fold: enabled(),
    check: amountToCall === 0 ? enabled() : disabled("INVALID_PHASE"),
    call: amountToCall > 0 && seat.tableStack >= amountToCall && seat.totalContribution + amountToCall <= cap
      ? enabled()
      : disabled(callReason),
    bet: context.currentBet === 0 && seat.tableStack >= context.bigBlind && seat.totalContribution + context.bigBlind <= cap
      ? enabled()
      : disabled(betReason),
    raise: context.currentBet > 0 && context.currentBet + context.minRaise <= maxRaiseTo
      ? enabled()
      : disabled(raiseReason),
    allIn: allInResult.ok ? enabled() : disabled(allInResult.reason),
  };
}

export function applyActionLabel(seat: HoldemSeat, action: HoldemActionKind): HoldemSeat {
  return { ...seat, hasActed: true, lastAction: action };
}
