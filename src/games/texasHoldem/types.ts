import type { Rate, RateId } from "@/types/casino";
import type { Card, RNG } from "@/types/card";
import type { GameEconomy } from "@/games/shared/economy";
import type { HandCategory, HandRank } from "@/games/shared/poker/handEvaluator";

export type { Card, RNG, Rate, RateId, GameEconomy, HandCategory, HandRank };

export interface HoldemRateConfig {
  rate: Rate;
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
}

export type HoldemPhase =
  | "unseated" | "buyIn" | "waitingHand" | "postingBlinds"
  | "dealingHoleCards" | "preflop" | "dealingFlop" | "flop"
  | "dealingTurn" | "turn" | "dealingRiver" | "river"
  | "showdown" | "settling" | "result";

export type HoldemAnimationPhase =
  | "idle" | "postingBlinds" | "dealingHoleCards" | "playerActing"
  | "cpuThinking" | "movingChips" | "dealingFlop" | "dealingTurn"
  | "dealingRiver" | "showdownReveal" | "settlingPot" | "resultBanner";

export type CpuStyle = "tightPassive" | "tightAggressive" | "loosePassive" | "looseAggressive";
export type SeatStatus = "active" | "folded" | "allIn" | "busted" | "sittingOut";
export type HoldemActionKind = "fold" | "check" | "call" | "bet" | "raise" | "allIn";
export type PreflopStrength = "premium" | "strong" | "playable" | "weak";

export interface HoldemSeat {
  id: string;
  name: string;
  seatIndex: number;
  isHuman: boolean;
  style?: CpuStyle;
  tableStack: number;
  holeCards: Card[];
  status: SeatStatus;
  streetContribution: number;
  totalContribution: number;
  hasActed: boolean;
  lastAction?: HoldemActionKind;
}

export interface Pot {
  amount: number;
}

export interface BestHoldemHand {
  cards: Card[];
  rank: HandRank;
  usedHoleCardCount: 0 | 1 | 2;
}

export type HoldemActionError =
  | "ANIMATING" | "NOT_SEATED" | "INVALID_PHASE" | "NOT_YOUR_TURN"
  | "INVALID_BET" | "INSUFFICIENT_CHIPS" | "INSUFFICIENT_TABLE_STACK"
  | "REBUY_REQUIRED" | "SIDE_POT_NOT_SUPPORTED" | "DECK_EXHAUSTED"
  | "DUPLICATE_CARD"
  // §29.1 の不正カード検出対応。仕様 §19.1 にはないが、型安全のため追加。
  | "INVALID_CARD"
  | "ECONOMY_FAILED";

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: HoldemActionError; message: string };

export interface ActionAvailability {
  enabled: boolean;
  reason?: HoldemActionError;
}

export interface AvailableActions {
  fold: ActionAvailability;
  check: ActionAvailability;
  call: ActionAvailability;
  bet: ActionAvailability;
  raise: ActionAvailability;
  allIn: ActionAvailability;
}

export type AnimationEvent =
  // Blind posting also uses placeToPot internally.
  // Animation contract:
  // - POST_BLIND is emitted for SB/BB posting.
  // - CHIP_TO_POT is emitted for voluntary actions.
  // Do not emit both for the same blind payment.
  | { id: string; type: "POST_BLIND"; seat: number; amount: number }
  | { id: string; type: "DEAL_HOLE"; seat: number; cardIndex: 0 | 1; faceUp: boolean }
  | { id: string; type: "REVEAL_FLOP"; cards: [Card, Card, Card] }
  | { id: string; type: "REVEAL_TURN"; card: Card }
  | { id: string; type: "REVEAL_RIVER"; card: Card }
  | { id: string; type: "CPU_THINKING"; seat: number; ms: number }
  | { id: string; type: "PLAYER_ACTION_LABEL"; seat: number; action: HoldemActionKind; amount?: number }
  | { id: string; type: "CHIP_TO_POT"; seat: number; amount: number; potAfter: number }
  | { id: string; type: "FLIP_HOLE"; seat: number }
  | { id: string; type: "HIGHLIGHT_BEST"; seat: number; cards: Card[] }
  | { id: string; type: "AWARD_POT"; seat: number; amount: number; isSplit: boolean }
  | { id: string; type: "RESULT_BANNER"; winners: number[]; category: HandCategory | "fold" };

export interface HoldemSettlement {
  seatIndex: number;
  seatId: string;
  wonAmount: number;
  // profit = wonAmount - totalContributionInHand
  profit: number;
  isHuman: boolean;
}

export interface HoldemShowdownHand {
  seatIndex: number;
  seatId: string;
  bestHand: BestHoldemHand;
}

export interface HoldemResult {
  handId: number;
  reason: "fold" | "showdown";
  winners: HoldemSettlement[];
  settlements: HoldemSettlement[];
  showdownHands: HoldemShowdownHand[];
  totalPotAmount: number;
  playerWonAmount: number;
  playerProfit: number;
  winningCategory: HandCategory | "fold";
}

export type HoldemDeckProvider = () => Card[];

export interface UseTexasHoldemOptions {
  rate: Rate;
  economy: GameEconomy;
  rng?: RNG;
  deckProvider?: HoldemDeckProvider;
  animationEnabled?: boolean;
}

export interface UseTexasHoldemReturn {
  phase: HoldemPhase;
  animationPhase: HoldemAnimationPhase;
  rate: Rate | null;
  smallBlind: number;
  bigBlind: number;

  seats: HoldemSeat[];
  playerSeatIndex: number | null;
  dealerButtonIndex: number | null;
  smallBlindIndex: number | null;
  bigBlindIndex: number | null;
  currentTurnSeatIndex: number | null;

  deckRemaining: number;
  communityCards: Card[];
  pot: Pot;
  currentBet: number;
  minRaise: number;
  amountToCall: number;
  handContributionCap: number;
  maxRaiseTo: number;
  tableStack: number;

  availableActions: AvailableActions;
  animationEvents: AnimationEvent[];

  lastResult: HoldemResult | null;
  actionError: HoldemActionError | null;
  isAnimating: boolean;
  isResolving: boolean;

  buyIn: (amount: number) => ActionResult;
  startHand: () => ActionResult;
  fold: () => ActionResult;
  check: () => ActionResult;
  call: () => ActionResult;
  bet: (amount: number) => ActionResult;
  raiseTo: (amount: number) => ActionResult;
  allIn: () => ActionResult;
  rebuy: (newTableStack: number) => ActionResult;
  exitTable: () => ActionResult;
  clearResult: () => void;

  onAnimationEventComplete: (eventId: string) => void;
}
