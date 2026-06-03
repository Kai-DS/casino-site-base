import { describe, it, expect } from "vitest";
import { PAYOUT_MEDALS, payoutForRole, isBonusRole, theoreticalRtp } from "./payout";
import { BET_MEDALS } from "../data/reels";

describe("neonjack payout", () => {
  it("REPLAY refunds exactly the bet (net 0)", () => {
    expect(PAYOUT_MEDALS.replay).toBe(BET_MEDALS);
    expect(payoutForRole("replay") - BET_MEDALS).toBe(0);
  });

  it("BLANK pays nothing", () => {
    expect(payoutForRole("blank")).toBe(0);
  });

  it("bonuses pay more than the bet", () => {
    expect(payoutForRole("big")).toBeGreaterThan(BET_MEDALS);
    expect(payoutForRole("reg")).toBeGreaterThan(BET_MEDALS);
  });

  it("only BIG and REG are bonuses", () => {
    expect(isBonusRole("big")).toBe(true);
    expect(isBonusRole("reg")).toBe(true);
    for (const r of ["grape", "cherry", "replay", "blank"] as const) {
      expect(isBonusRole(r)).toBe(false);
    }
  });

  it("RTP is Juggler-like (slightly below 100%)", () => {
    const rtp = theoreticalRtp();
    expect(rtp).toBeGreaterThan(0.9);
    expect(rtp).toBeLessThan(1.0);
    expect(rtp).toBeCloseTo(0.966, 2);
  });
});
