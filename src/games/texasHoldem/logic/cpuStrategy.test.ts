import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "@/types/card";
import { cardId } from "@/types/card";
import type { AvailableActions, HoldemSeat } from "../types";
import { chooseCpuAction, evaluatePreflopStrength } from "./cpuStrategy";

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), rank, suit });

function seat(overrides: Partial<HoldemSeat>): HoldemSeat {
  return {
    id: "cpu",
    name: "CPU",
    seatIndex: 1,
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

const enabledActions: AvailableActions = {
  fold: { enabled: true },
  check: { enabled: true },
  call: { enabled: true },
  bet: { enabled: true },
  raise: { enabled: true },
  allIn: { enabled: true },
};

function actions(overrides: Partial<AvailableActions> = {}): AvailableActions {
  return {
    ...enabledActions,
    ...overrides,
  };
}

function choose(overrides: Partial<Parameters<typeof chooseCpuAction>[0]>) {
  const cpu = overrides.seat ?? seat({});
  return chooseCpuAction({
    seat: cpu,
    seats: overrides.seats ?? [cpu, seat({ id: "other", seatIndex: 2 })],
    currentBet: overrides.currentBet ?? 0,
    bigBlind: overrides.bigBlind ?? 2,
    minRaise: overrides.minRaise ?? 2,
    phase: overrides.phase,
    availableActions: overrides.availableActions ?? enabledActions,
  });
}

describe("cpuStrategy", () => {
  it("classifies simple preflop strengths for later strategy tuning", () => {
    expect(evaluatePreflopStrength(seat({ holeCards: [c(14, "spades"), c(14, "hearts")] }))).toBe("premium");
    expect(evaluatePreflopStrength(seat({ holeCards: [c(11, "spades"), c(11, "hearts")] }))).toBe("strong");
    expect(evaluatePreflopStrength(seat({ holeCards: [c(8, "spades"), c(7, "spades")] }))).toBe("playable");
    expect(evaluatePreflopStrength(seat({ holeCards: [c(9, "spades"), c(2, "hearts")] }))).toBe("weak");
  });

  it("checks for free and calls only when the action contract allows it", () => {
    const cpu = seat({ streetContribution: 2, totalContribution: 2 });
    expect(choose({ seat: cpu, currentBet: 2 }))
      .toEqual({ action: "check" });

    const caller = seat({ streetContribution: 0, totalContribution: 0, tableStack: 10 });
    expect(choose({ seat: caller, currentBet: 4, availableActions: actions({ raise: { enabled: false, reason: "INVALID_BET" } }) }))
      .toEqual({ action: "call", amount: 4 });

    const blocked = seat({ streetContribution: 0, totalContribution: 0, tableStack: 100 });
    expect(choose({
      seat: blocked,
      seats: [blocked, seat({ id: "short", seatIndex: 2, tableStack: 2 })],
      currentBet: 4,
      availableActions: actions({
        call: { enabled: false, reason: "INVALID_BET" },
        raise: { enabled: false, reason: "INVALID_BET" },
        allIn: { enabled: false, reason: "INVALID_BET" },
      }),
    }))
      .toEqual({ action: "fold" });
  });

  it("folds weak preflop hands when facing a bet", () => {
    const weak = seat({ holeCards: [c(9, "spades"), c(2, "hearts")] });

    expect(choose({ seat: weak, currentBet: 4, bigBlind: 2, phase: "preflop" }))
      .toEqual({ action: "fold" });
  });

  it("raises premium hands without exceeding the effective amount", () => {
    const premium = seat({
      style: "tightAggressive",
      holeCards: [c(14, "spades"), c(14, "hearts")],
      tableStack: 100,
      streetContribution: 2,
      totalContribution: 2,
    });

    expect(choose({ seat: premium, currentBet: 4, minRaise: 2, phase: "preflop" }))
      .toEqual({ action: "raise", raiseTo: 6 });
  });

  it("bets only when the available action contract allows it", () => {
    const aggressive = seat({ style: "looseAggressive", holeCards: [c(8, "spades"), c(7, "spades")] });

    expect(choose({ seat: aggressive, currentBet: 0, phase: "flop" })).toEqual({ action: "bet", amount: 4 });
    expect(choose({
      seat: aggressive,
      currentBet: 0,
      phase: "flop",
      availableActions: actions({ bet: { enabled: false, reason: "INVALID_BET" } }),
    })).toEqual({ action: "check" });
  });

  it("uses legal all-in when the chosen raise consumes the stack", () => {
    const premiumShort = seat({
      style: "tightAggressive",
      holeCards: [c(14, "spades"), c(14, "hearts")],
      tableStack: 4,
      streetContribution: 2,
      totalContribution: 2,
    });

    expect(choose({ seat: premiumShort, currentBet: 4, minRaise: 2, phase: "preflop" }))
      .toEqual({ action: "allIn", amount: 4 });
  });

  it("uses the effective all-in amount when an aggressive bet consumes the effective stack", () => {
    const chipLeader = seat({
      style: "looseAggressive",
      holeCards: [c(8, "spades"), c(7, "spades")],
      tableStack: 100,
    });
    const shortOpponent = seat({ id: "short", seatIndex: 2, tableStack: 3 });

    expect(choose({
      seat: chipLeader,
      seats: [chipLeader, shortOpponent],
      currentBet: 0,
      phase: "flop",
      availableActions: actions({ allIn: { enabled: true, amount: 3 } }),
    })).toEqual({ action: "allIn", amount: 3 });
  });

  it("does not choose all-in when the action contract disables all-in", () => {
    const betweenCallAndFullRaise = seat({
      style: "tightAggressive",
      holeCards: [c(14, "spades"), c(14, "hearts")],
      tableStack: 5,
      streetContribution: 1,
      totalContribution: 1,
    });

    expect(choose({
      seat: betweenCallAndFullRaise,
      currentBet: 5,
      minRaise: 2,
      phase: "preflop",
      availableActions: actions({
        raise: { enabled: false, reason: "INVALID_BET" },
        allIn: { enabled: false, reason: "INVALID_BET" },
      }),
    })).not.toMatchObject({ action: "allIn" });

    const belowCurrentBet = seat({
      style: "tightAggressive",
      holeCards: [c(14, "spades"), c(14, "hearts")],
      tableStack: 3,
      streetContribution: 1,
      totalContribution: 1,
    });

    expect(choose({
      seat: belowCurrentBet,
      currentBet: 5,
      minRaise: 2,
      phase: "preflop",
      availableActions: actions({
        call: { enabled: false, reason: "INSUFFICIENT_TABLE_STACK" },
        raise: { enabled: false, reason: "INVALID_BET" },
        allIn: { enabled: false, reason: "INVALID_BET" },
      }),
    })).not.toMatchObject({ action: "allIn" });
  });
});
