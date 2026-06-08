import { describe, expect, it, vi } from "vitest";
import type { GameEconomy, GameResultDraft } from "@/games/shared/economy";
import type { HoldemSeat, Pot } from "../types";
import {
  calculateAvailableActions,
  getHandContributionCap,
  placeToPot,
  resetOtherActivePlayersHasActed,
  validateAllIn,
} from "./betting";

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

  it("rejects cap-breaking contributions before moving chips", () => {
    const economy = makeEconomy(1_000);
    const seats = [
      seat({ id: "human", isHuman: true, tableStack: 100 }),
      seat({ id: "short", seatIndex: 1, tableStack: 20 }),
    ];

    const result = placeToPot({ seats, pot: { amount: 0 }, playerId: "human", amount: 30, economy });

    expect(result).toMatchObject({ ok: false, reason: "SIDE_POT_NOT_SUPPORTED" });
    expect(economy.placeBet).not.toHaveBeenCalled();
    expect(economy.chips).toBe(1_000);
  });

  it("rejects All-in raises in the forbidden zone and below currentBet", () => {
    const forbidden = seat({
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

    expect(validateAllIn(forbidden, [forbidden, seat({ id: "cpu", seatIndex: 1, tableStack: 100 })], 12, 10, 10))
      .toMatchObject({ ok: false, reason: "SIDE_POT_NOT_SUPPORTED" });
    expect(validateAllIn(belowCall, [belowCall, seat({ id: "cpu", seatIndex: 1, tableStack: 100 })], 10, 10, 10))
      .toMatchObject({ ok: false, reason: "SIDE_POT_NOT_SUPPORTED" });
  });

  it("rejects cap-breaking All-in as SIDE_POT_NOT_SUPPORTED", () => {
    const deep = seat({ id: "human", isHuman: true, tableStack: 100 });
    const short = seat({ id: "short", seatIndex: 1, tableStack: 20 });

    expect(validateAllIn(deep, [deep, short], 0, 10, 10))
      .toMatchObject({ ok: false, reason: "SIDE_POT_NOT_SUPPORTED" });
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
});
