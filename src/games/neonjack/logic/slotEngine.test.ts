import { describe, it, expect } from "vitest";
import { drawRole, spin } from "./slotEngine";
import { payoutForRole } from "./payout";
import { BET_MEDALS, WEIGHT_TOTAL } from "../data/reels";
import type { Rng } from "@/utils/random";

/** Build a deterministic rng that returns the value mapping `ticket / WEIGHT_TOTAL`. */
const ticketRng = (ticket: number): Rng => () => ticket / WEIGHT_TOTAL;

describe("neonjack slotEngine", () => {
  it("draws the first weight bucket (BIG) for a tiny ticket", () => {
    expect(drawRole(ticketRng(0))).toBe("big");
    expect(drawRole(ticketRng(365))).toBe("big"); // weight 366
  });

  it("draws REG just past the BIG bucket", () => {
    expect(drawRole(ticketRng(366))).toBe("reg");
  });

  it("draws BLANK at the top of the range", () => {
    expect(drawRole(ticketRng(WEIGHT_TOTAL - 1))).toBe("blank");
  });

  it("spin() always bets 3 medals and pays out per role", () => {
    const out = spin(ticketRng(0)); // BIG
    expect(out.betMedals).toBe(BET_MEDALS);
    expect(out.role).toBe("big");
    expect(out.payoutMedals).toBe(payoutForRole("big"));
    expect(out.isBonus).toBe(true);
    expect(out.lampOn).toBe(true);
    expect(out.reels).toHaveLength(3);
  });

  it("non-bonus spins keep the GOGO lamp off", () => {
    const grape = spin(ticketRng(600)); // inside grape bucket
    expect(grape.role).toBe("grape");
    expect(grape.isBonus).toBe(false);
    expect(grape.lampOn).toBe(false);
  });
});
