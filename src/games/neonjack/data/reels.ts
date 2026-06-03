// games/neonjack/data/reels.ts — symbol data + the weighted outcome table.
// These numbers define the machine's "setting"; tuned to ~96.6% RTP (Juggler-like).
import type { SlotSymbol, SpinRole, ReelLine } from "../types";

export const BET_MEDALS = 3; // fixed 3-medal bet (real-machine model, spec §5.5)

export const SYMBOL_GLYPH: Record<SlotSymbol, string> = {
  seven: "7",
  bar: "BAR",
  grape: "🍇",
  cherry: "🍒",
  replay: "↻",
  blank: "◆",
};

// Neon palette per symbol (tailwind text-color classes).
export const SYMBOL_COLOR: Record<SlotSymbol, string> = {
  seven: "text-neon-red",
  bar: "text-neon-blue",
  grape: "text-purple-400",
  cherry: "text-red-400",
  replay: "text-cyan-300",
  blank: "text-white/30",
};

/** Centre-payline symbols shown for each role. */
export const ROLE_REELS: Record<SpinRole, ReelLine> = {
  big: ["seven", "seven", "seven"],
  reg: ["seven", "seven", "bar"],
  grape: ["grape", "grape", "grape"],
  cherry: ["cherry", "blank", "blank"],
  replay: ["replay", "replay", "replay"],
  blank: ["bar", "grape", "seven"], // deliberately non-aligned
};

/** Reel strip used purely for the spinning-blur animation. */
export const REEL_STRIP: readonly SlotSymbol[] = [
  "seven",
  "grape",
  "cherry",
  "bar",
  "replay",
  "blank",
  "grape",
  "seven",
  "bar",
  "grape",
];

/**
 * Weighted outcome table. Weights are out of {WEIGHT_TOTAL}; chosen so that
 * expected payout ≈ 2.9 / 3 medals ≈ 96.6% RTP. Order is irrelevant (cumulative draw).
 */
export const OUTCOME_WEIGHTS: ReadonlyArray<{ role: SpinRole; weight: number }> = [
  { role: "big", weight: 366 }, // ~1/273
  { role: "reg", weight: 228 }, // ~1/439
  { role: "grape", weight: 16667 }, // ~1/6
  { role: "cherry", weight: 2857 }, // ~1/35
  { role: "replay", weight: 13700 }, // ~1/7.3
  { role: "blank", weight: 66182 }, // remainder
];

export const WEIGHT_TOTAL = OUTCOME_WEIGHTS.reduce((sum, o) => sum + o.weight, 0); // 100000
