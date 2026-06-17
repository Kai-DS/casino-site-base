import { describe, expect, it } from "vitest";
import {
  readRouletteDebugMotionFromSearch,
  rouletteDebugOverlayEnabledFromSearch,
} from "./rouletteDebugMotion";

describe("roulette debug query production hardening", () => {
  it("allows mode and variant overrides when debug queries are enabled", () => {
    expect(
      readRouletteDebugMotionFromSearch(
        "standard",
        "?rouletteMode=full&rouletteVariant=full_suspense_hang",
        true,
      ),
    ).toEqual({ mode: "full", variantOverride: "full_suspense_hang" });

    expect(rouletteDebugOverlayEnabledFromSearch("?rouletteDebugMotion=1", true)).toBe(true);
  });

  it("ignores mode, variant, and overlay debug queries when disabled", () => {
    expect(
      readRouletteDebugMotionFromSearch(
        "standard",
        "?rouletteMode=full&rouletteVariant=full_suspense_hang",
        false,
      ),
    ).toEqual({ mode: "standard", variantOverride: null });

    expect(rouletteDebugOverlayEnabledFromSearch("?rouletteDebugMotion=1", false)).toBe(false);
  });
});
