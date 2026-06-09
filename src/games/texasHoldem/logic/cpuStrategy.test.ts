import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "@/types/card";
import { cardId } from "@/types/card";
import type { HoldemSeat } from "../types";
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

describe("cpuStrategy Phase 2 baseline", () => {
  it("classifies simple preflop strengths for later strategy tuning", () => {
    expect(evaluatePreflopStrength(seat({ holeCards: [c(14, "spades"), c(14, "hearts")] }))).toBe("premium");
    expect(evaluatePreflopStrength(seat({ holeCards: [c(11, "spades"), c(11, "hearts")] }))).toBe("strong");
    expect(evaluatePreflopStrength(seat({ holeCards: [c(8, "spades"), c(7, "spades")] }))).toBe("playable");
    expect(evaluatePreflopStrength(seat({ holeCards: [c(9, "spades"), c(2, "hearts")] }))).toBe("weak");
  });

  it("checks for free and calls only inside stack/cap limits", () => {
    const cpu = seat({ streetContribution: 2, totalContribution: 2 });
    expect(chooseCpuAction({ seat: cpu, seats: [cpu, seat({ id: "other", seatIndex: 2 })], currentBet: 2 }))
      .toEqual({ action: "check" });

    const caller = seat({ streetContribution: 0, totalContribution: 0, tableStack: 10 });
    expect(chooseCpuAction({ seat: caller, seats: [caller, seat({ id: "other", seatIndex: 2 })], currentBet: 4 }))
      .toEqual({ action: "call", amount: 4 });

    const capped = seat({ streetContribution: 0, totalContribution: 0, tableStack: 100 });
    expect(chooseCpuAction({ seat: capped, seats: [capped, seat({ id: "short", seatIndex: 2, tableStack: 2 })], currentBet: 4 }))
      .toEqual({ action: "fold" });
  });

  it("folds weak preflop hands when facing a bet", () => {
    const weak = seat({ holeCards: [c(9, "spades"), c(2, "hearts")] });

    expect(chooseCpuAction({ seat: weak, seats: [weak, seat({ id: "other", seatIndex: 2 })], currentBet: 4, phase: "preflop" }))
      .toEqual({ action: "fold" });
  });
});
