import { describe, expect, it, vi } from "vitest";
import type { GameEconomy, GameResultDraft } from "@/games/shared/economy";
import type { HoldemSeat, Pot } from "../types";
import {
  calculateAvailableActions,
  getEffectiveAllInAmount,
  getHandContributionCap,
  placeToPot,
  resetOtherActivePlayersHasActed,
  validateAllIn,
} from "./betting";
import { buildFoldResult, buildShowdownResult, buildSidePots } from "./pot";
import * as holdemEvaluator from "./holdemEvaluator";

type TestEconomy = GameEconomy & {
  placeBet: ReturnType<typeof vi.fn<(amount: number) => boolean>>;
  settle: ReturnType<typeof vi.fn<(draft: GameResultDraft) => void>>;
};

function makeEconomy(initialChips = 1_000): TestEconomy {
  let chips = initialChips;
  return {
    get chips() {
      return chips;
    },
    placeBet: vi.fn((amount: number) => {
      if (chips < amount) return false;
      chips -= amount;
      return true;
    }),
    settle: vi.fn((draft: GameResultDraft) => {
      chips += draft.payout;
    }),
  };
}

function seat(overrides: Partial<HoldemSeat>): HoldemSeat {
  return {
    id: "seat",
    name: "Seat",
    seatIndex: 0,
    isHuman: false,
    tableStack: 100,
    holeCards: [],
    status: "active",
    streetContribution: 0,
    totalContribution: 0,
    hasActed: false,
    ...overrides,
  };
}

describe("Texas Hold'em betting core", () => {
  it("calculates handContributionCap from active/allIn contenders only", () => {
    const seats = [
      seat({ id: "human", isHuman: true, tableStack: 100 }),
      seat({ id: "short", seatIndex: 1, tableStack: 40 }),
      seat({ id: "folded", seatIndex: 2, tableStack: 5, status: "folded" }),
    ];

    expect(getHandContributionCap(seats)).toBe(40);
  });

  it("moves human chips and tableStack in lockstep through placeToPot", () => {
    const economy = makeEconomy(1_000);
    const seats = [
      seat({ id: "human", isHuman: true, tableStack: 100 }),
      seat({ id: "cpu", seatIndex: 1, tableStack: 100 }),
    ];
    const pot: Pot = { amount: 0 };

    const result = placeToPot({ seats, pot, playerId: "human", amount: 25, economy });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(economy.chips).toBe(975);
    expect(result.seat.tableStack).toBe(75);
    expect(result.seat.streetContribution).toBe(25);
    expect(result.seat.totalContribution).toBe(25);
    expect(result.pot.amount).toBe(25);
  });

  it("normalizes active seats with zero stack to allIn after blind payment", () => {
    const economy = makeEconomy(10);
    const seats = [
      seat({ id: "human", isHuman: true, tableStack: 2 }),
      seat({ id: "cpu", seatIndex: 1, tableStack: 20 }),
    ];

    const result = placeToPot({ seats, pot: { amount: 0 }, playerId: "human", amount: 2, economy });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.seat.tableStack).toBe(0);
    expect(result.seat.status).toBe("allIn");
    expect(result.seat.hasActed).toBe(true);
  });

  it("calculates effective all-in per actor and ignores folded stacks", () => {
    const hero = seat({ id: "hero", isHuman: true, tableStack: 10_000 });
    const a = seat({ id: "a", seatIndex: 1, tableStack: 4_000 });
    const b = seat({ id: "b", seatIndex: 2, tableStack: 6_000 });
    const c = seat({ id: "c", seatIndex: 3, tableStack: 9_000 });
    const seats = [hero, a, b, c];

    expect(getEffectiveAllInAmount(hero, seats)).toBe(9_000);
    expect(getEffectiveAllInAmount(a, seats)).toBe(4_000);
    expect(getEffectiveAllInAmount(b, seats)).toBe(6_000);
    expect(getEffectiveAllInAmount(c, seats)).toBe(9_000);

    const shortHero = seat({ id: "short-hero", isHuman: true, tableStack: 3_000 });
    const deepVillain = seat({ id: "deep", seatIndex: 1, tableStack: 10_000 });
    expect(getEffectiveAllInAmount(shortHero, [shortHero, deepVillain])).toBe(3_000);
    expect(getEffectiveAllInAmount(deepVillain, [shortHero, deepVillain])).toBe(3_000);

    const foldedDeep = seat({ id: "folded-deep", seatIndex: 2, tableStack: 12_000, status: "folded" });
    const liveShort = seat({ id: "live-short", seatIndex: 3, tableStack: 7_000 });
    expect(getEffectiveAllInAmount(hero, [hero, a, foldedDeep, liveShort])).toBe(7_000);

    const contributedHero = seat({
      id: "contributed-hero",
      isHuman: true,
      streetContribution: 500,
      totalContribution: 500,
      tableStack: 9_500,
    });
    const contributedOpponent = seat({
      id: "contributed-opponent",
      seatIndex: 1,
      streetContribution: 1_000,
      totalContribution: 1_000,
      tableStack: 4_000,
    });
    expect(getEffectiveAllInAmount(contributedHero, [contributedHero, contributedOpponent])).toBe(4_500);
  });

  it("allows side-pot contributions through placeToPot", () => {
    const economy = makeEconomy(1_000);
    const seats = [
      seat({ id: "human", isHuman: true, tableStack: 100 }),
      seat({ id: "short", seatIndex: 1, tableStack: 20 }),
    ];

    const result = placeToPot({ seats, pot: { amount: 0 }, playerId: "human", amount: 30, economy });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.seat.tableStack).toBe(70);
    expect(result.seat.streetContribution).toBe(30);
    expect(result.seat.totalContribution).toBe(30);
    expect(result.pot.amount).toBe(30);
    expect(economy.chips).toBe(970);
  });

  it("allows short and min-raise-below all-in amounts", () => {
    const belowMinRaise = seat({
      id: "human",
      isHuman: true,
      tableStack: 5,
      streetContribution: 10,
      totalContribution: 10,
    });
    const belowCall = seat({
      id: "human",
      isHuman: true,
      tableStack: 5,
      streetContribution: 0,
      totalContribution: 0,
    });

    expect(validateAllIn(belowMinRaise, [belowMinRaise, seat({ id: "cpu", seatIndex: 1, tableStack: 100 })], 12, 10, 10))
      .toEqual({ ok: true });
    expect(validateAllIn(belowCall, [belowCall, seat({ id: "cpu", seatIndex: 1, tableStack: 100 })], 10, 10, 10))
      .toEqual({ ok: true });
  });

  it("limits chip-leader all-in to the effective amount", () => {
    const deep = seat({ id: "human", isHuman: true, tableStack: 100 });
    const short = seat({ id: "short", seatIndex: 1, tableStack: 20 });

    expect(getEffectiveAllInAmount(deep, [deep, short])).toBe(20);
    expect(validateAllIn(deep, [deep, short], 0, 10, 10, 20)).toEqual({ ok: true });
    expect(validateAllIn(deep, [deep, short], 0, 10, 10, 19))
      .toMatchObject({ ok: false, reason: "INVALID_BET" });
    expect(validateAllIn(deep, [deep, short], 0, 10, 10, 21))
      .toMatchObject({ ok: false, reason: "INVALID_BET" });
  });

  it("keeps the preflop BB option: BB can check last when nobody raised", () => {
    const seats = [
      seat({ id: "dealer", seatIndex: 0, hasActed: true }),
      seat({ id: "sb", seatIndex: 1, streetContribution: 1, totalContribution: 1, hasActed: true }),
      seat({ id: "bb", seatIndex: 2, streetContribution: 2, totalContribution: 2, hasActed: false }),
      seat({ id: "utg", seatIndex: 3, hasActed: true }),
      seat({ id: "cutoff", seatIndex: 4, hasActed: true }),
    ];

    const actions = calculateAvailableActions({
      seats,
      playerSeatIndex: 2,
      currentTurnSeatIndex: 2,
      currentBet: 2,
      bigBlind: 2,
      minRaise: 2,
    });

    expect(actions.check.enabled).toBe(true);
    expect(actions.raise.enabled).toBe(true);
  });

  it("resets other active players when BB uses the option to raise", () => {
    const bb = seat({
      id: "bb",
      seatIndex: 2,
      streetContribution: 6,
      totalContribution: 6,
      hasActed: true,
      lastAction: "raise",
    });
    const seats = [
      seat({ id: "dealer", seatIndex: 0, hasActed: true }),
      seat({ id: "sb", seatIndex: 1, hasActed: true }),
      bb,
      seat({ id: "utg", seatIndex: 3, hasActed: true }),
      seat({ id: "folded", seatIndex: 4, status: "folded", hasActed: true }),
    ];

    const reset = resetOtherActivePlayersHasActed(seats, bb.id);

    expect(reset.find((candidate) => candidate.id === "bb")?.hasActed).toBe(true);
    expect(reset.find((candidate) => candidate.id === "dealer")?.hasActed).toBe(false);
    expect(reset.find((candidate) => candidate.id === "sb")?.hasActed).toBe(false);
    expect(reset.find((candidate) => candidate.id === "utg")?.hasActed).toBe(false);
    expect(reset.find((candidate) => candidate.id === "folded")?.hasActed).toBe(true);
  });

  it("builds a fold result without showdown evaluation or refunds", () => {
    const rankSpy = vi.spyOn(holdemEvaluator, "rankBestOfSeven");
    const seats = [
      seat({ id: "winner", isHuman: true, tableStack: 96, totalContribution: 4 }),
      seat({ id: "small-blind", seatIndex: 1, tableStack: 99, totalContribution: 1, status: "folded" }),
      seat({ id: "big-blind", seatIndex: 2, tableStack: 98, totalContribution: 2, status: "folded" }),
    ];

    const result = buildFoldResult({
      handId: 1,
      seats,
      winnerSeatIndex: 0,
      pot: { amount: 7 },
      dealerButtonIndex: 0,
    });

    expect(result.reason).toBe("fold");
    expect(result.showdownHands).toEqual([]);
    expect(result.winningCategory).toBe("fold");
    expect(result.totalPotAmount).toBe(7);
    expect(result.winners).toEqual([expect.objectContaining({ seatIndex: 0, wonAmount: 7, profit: 3 })]);
    expect(result.settlements.find((settlement) => settlement.seatIndex === 1)?.profit).toBe(-1);
    expect(result.settlements.find((settlement) => settlement.seatIndex === 2)?.profit).toBe(-2);
    expect(rankSpy).not.toHaveBeenCalled();
    rankSpy.mockRestore();
  });

  it("reports availableActions reasons and effective all-in amounts", () => {
    const notTurn = calculateAvailableActions({
      seats: [seat({ id: "player", isHuman: true }), seat({ id: "cpu", seatIndex: 1 })],
      playerSeatIndex: 0,
      currentTurnSeatIndex: 1,
      currentBet: 0,
      bigBlind: 2,
      minRaise: 2,
    });
    expect(Object.values(notTurn).every((action) => !action.enabled && action.reason === "NOT_YOUR_TURN")).toBe(true);

    const checkable = calculateAvailableActions({
      seats: [seat({ id: "player", isHuman: true, streetContribution: 2, totalContribution: 2 }), seat({ id: "cpu", seatIndex: 1 })],
      playerSeatIndex: 0,
      currentTurnSeatIndex: 0,
      currentBet: 2,
      bigBlind: 2,
      minRaise: 2,
    });
    expect(checkable.check.enabled).toBe(true);

    const callable = calculateAvailableActions({
      seats: [seat({ id: "player", isHuman: true, tableStack: 10, streetContribution: 2, totalContribution: 2 }), seat({ id: "cpu", seatIndex: 1 })],
      playerSeatIndex: 0,
      currentTurnSeatIndex: 0,
      currentBet: 4,
      bigBlind: 2,
      minRaise: 2,
    });
    expect(callable.call.enabled).toBe(true);

    const shortCall = calculateAvailableActions({
      seats: [seat({ id: "player", isHuman: true, tableStack: 1 }), seat({ id: "cpu", seatIndex: 1 })],
      playerSeatIndex: 0,
      currentTurnSeatIndex: 0,
      currentBet: 2,
      bigBlind: 2,
      minRaise: 2,
    });
    expect(shortCall.call).toEqual({ enabled: true });
    expect(shortCall.allIn).toEqual({ enabled: true, amount: 1 });

    const cappedBet = calculateAvailableActions({
      seats: [seat({ id: "player", isHuman: true, tableStack: 100 }), seat({ id: "short", seatIndex: 1, tableStack: 1 })],
      playerSeatIndex: 0,
      currentTurnSeatIndex: 0,
      currentBet: 0,
      bigBlind: 2,
      minRaise: 2,
    });
    expect(cappedBet.bet).toEqual({ enabled: false, reason: "INVALID_BET" });
    expect(cappedBet.allIn).toEqual({ enabled: true, amount: 1 });

    const cappedRaise = calculateAvailableActions({
      seats: [
        seat({ id: "player", isHuman: true, tableStack: 100, streetContribution: 2, totalContribution: 2 }),
        seat({ id: "short", seatIndex: 1, tableStack: 2, streetContribution: 2, totalContribution: 2 }),
      ],
      playerSeatIndex: 0,
      currentTurnSeatIndex: 0,
      currentBet: 4,
      bigBlind: 2,
      minRaise: 2,
    });
    expect(cappedRaise.raise).toEqual({ enabled: false, reason: "INVALID_BET" });
    expect(cappedRaise.allIn).toEqual({ enabled: true, amount: 2 });

    const belowMinRaiseAllIn = calculateAvailableActions({
      seats: [
        seat({ id: "player", isHuman: true, tableStack: 5, streetContribution: 10, totalContribution: 10 }),
        seat({ id: "cpu", seatIndex: 1, tableStack: 100 }),
      ],
      playerSeatIndex: 0,
      currentTurnSeatIndex: 0,
      currentBet: 12,
      bigBlind: 10,
      minRaise: 10,
    });
    expect(belowMinRaiseAllIn.allIn).toEqual({ enabled: true, amount: 5 });
  });

  it("builds side pots with correct eligible seats and settles each pot independently", () => {
    const seats = [
      seat({ id: "a", seatIndex: 0, totalContribution: 4_000, status: "allIn" }),
      seat({ id: "b", seatIndex: 1, totalContribution: 6_000, status: "allIn" }),
      seat({ id: "c", seatIndex: 2, totalContribution: 9_000, status: "allIn" }),
      seat({ id: "hero", seatIndex: 3, isHuman: true, totalContribution: 9_000, status: "active", effectiveAllInLocked: true }),
    ];

    expect(buildSidePots(seats)).toEqual([
      { amount: 16_000, cap: 4_000, eligibleSeatIds: ["a", "b", "c", "hero"] },
      { amount: 6_000, cap: 6_000, eligibleSeatIds: ["b", "c", "hero"] },
      { amount: 6_000, cap: 9_000, eligibleSeatIds: ["c", "hero"] },
    ]);

    const result = buildShowdownResult({
      handId: 1,
      seats,
      winnerSeatIndexes: [0],
      showdownHands: [
        { seatId: "a", seatIndex: 0, bestHand: { cards: [], usedHoleCardCount: 2, rank: { category: "royal_flush", tiebreak: [14] } } },
        { seatId: "b", seatIndex: 1, bestHand: { cards: [], usedHoleCardCount: 2, rank: { category: "one_pair", tiebreak: [14, 10, 9, 8] } } },
        { seatId: "c", seatIndex: 2, bestHand: { cards: [], usedHoleCardCount: 2, rank: { category: "high_card", tiebreak: [14, 13, 10, 9, 8] } } },
        { seatId: "hero", seatIndex: 3, bestHand: { cards: [], usedHoleCardCount: 2, rank: { category: "flush", tiebreak: [14, 12, 10, 8, 7] } } },
      ],
      pot: { amount: 28_000 },
      dealerButtonIndex: 0,
    });

    expect(result.sidePots).toHaveLength(3);
    expect(result.totalPotAmount).toBe(28_000);
    expect(result.sidePots.reduce((sum, sidePot) => sum + sidePot.amount, 0)).toBe(result.totalPotAmount);
    expect(result.settlements.find((settlement) => settlement.seatId === "a")?.wonAmount).toBe(16_000);
    expect(result.settlements.find((settlement) => settlement.seatId === "hero")?.wonAmount).toBe(12_000);
    expect(result.playerWonAmount).toBe(12_000);
    expect(result.playerProfit).toBe(3_000);
  });

  it("counts folded contributions in side pots but excludes folded seats from eligibility", () => {
    const seats = [
      seat({ id: "folded-a", seatIndex: 0, totalContribution: 4_000, status: "folded" }),
      seat({ id: "b", seatIndex: 1, totalContribution: 6_000, status: "allIn" }),
      seat({ id: "c", seatIndex: 2, totalContribution: 9_000, status: "allIn" }),
      seat({ id: "hero", seatIndex: 3, isHuman: true, totalContribution: 9_000, status: "active", effectiveAllInLocked: true }),
    ];

    expect(buildSidePots(seats)).toEqual([
      { amount: 16_000, cap: 4_000, eligibleSeatIds: ["b", "c", "hero"] },
      { amount: 6_000, cap: 6_000, eligibleSeatIds: ["b", "c", "hero"] },
      { amount: 6_000, cap: 9_000, eligibleSeatIds: ["c", "hero"] },
    ]);
  });

  it("keeps split-pot remainder ordering when folded contributions make an odd side pot", () => {
    const seats = [
      seat({ id: "a", seatIndex: 0, totalContribution: 1, status: "active" }),
      seat({ id: "b", seatIndex: 1, totalContribution: 1, status: "active" }),
      seat({ id: "folded-c", seatIndex: 2, totalContribution: 1, status: "folded" }),
      seat({ id: "folded-d", seatIndex: 3, totalContribution: 1, status: "folded" }),
      seat({ id: "folded-e", seatIndex: 4, totalContribution: 1, status: "folded" }),
    ];

    const result = buildShowdownResult({
      handId: 2,
      seats,
      winnerSeatIndexes: [0, 1],
      showdownHands: [
        { seatId: "a", seatIndex: 0, bestHand: { cards: [], usedHoleCardCount: 2, rank: { category: "straight", tiebreak: [14] } } },
        { seatId: "b", seatIndex: 1, bestHand: { cards: [], usedHoleCardCount: 2, rank: { category: "straight", tiebreak: [14] } } },
      ],
      pot: { amount: 5 },
      dealerButtonIndex: 4,
    });

    expect(result.sidePots).toEqual([
      { amount: 5, cap: 1, eligibleSeatIds: ["a", "b"] },
    ]);
    expect(result.settlements.find((settlement) => settlement.seatId === "a")?.wonAmount).toBe(3);
    expect(result.settlements.find((settlement) => settlement.seatId === "b")?.wonAmount).toBe(2);
    expect(result.settlements.find((settlement) => settlement.seatId === "folded-c")?.wonAmount).toBe(0);
  });
});
