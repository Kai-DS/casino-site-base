// components/roulette/motion.ts
// Per-event timing + the UI "camera" plan. Cinematic addendum §7 OVERRIDES the base spec §6.6:
// durationFor now takes the animation mode and returns one of three duration tables. Event objects
// never carry their own duration — the queue's timer reads this, and ack stays timer-driven (never
// `animationend`). Reduced motion (OS or sandbox) or mode==="reduced" collapses to the short table.
import { useSyncExternalStore } from "react";
import type { AnimationEvent } from "@/games/roulette/types";
import type { RouletteAnimationMode, RouletteVisualFocus } from "./animationMode";

type EventType = AnimationEvent["type"];
type DurationTable = Readonly<Record<EventType, number>>;

/** §7.1 — tempo. Total ≈ 6–8s. */
export const STANDARD_DURATIONS: DurationTable = {
  NO_MORE_BETS: 500,
  SPIN_START: 1600,
  BALL_LAND: 2200,
  MARK_WINNER: 700,
  COLLECT_LOSING: 700,
  PAY_WINNING: 800,
  RESULT_BANNER: 1200,
} as const;

/** §7.2 — cinematic. Total ≈ 12–14s. */
export const FULL_DRAMA_DURATIONS: DurationTable = {
  NO_MORE_BETS: 700,
  SPIN_START: 3000,
  BALL_LAND: 5000,
  MARK_WINNER: 1300,
  COLLECT_LOSING: 900,
  PAY_WINNING: 1100,
  RESULT_BANNER: 1600,
} as const;

/** §7.3 — short. Total ≈ 1–2s. */
export const REDUCED_DURATIONS: DurationTable = {
  NO_MORE_BETS: 100,
  SPIN_START: 150,
  BALL_LAND: 200,
  MARK_WINNER: 100,
  COLLECT_LOSING: 100,
  PAY_WINNING: 150,
  RESULT_BANNER: 400,
} as const;

/**
 * Completion gate (ms) for one AnimationEvent before onAnimationEventComplete fires.
 * This is the ack timing — it never depends on a DOM animation finishing (addendum §7.4).
 */
export function durationForType(
  type: EventType,
  mode: RouletteAnimationMode,
  reducedMotion: boolean,
): number {
  if (reducedMotion || mode === "reduced") return REDUCED_DURATIONS[type];
  if (mode === "full") return FULL_DRAMA_DURATIONS[type];
  return STANDARD_DURATIONS[type];
}

export function durationFor(
  event: AnimationEvent,
  mode: RouletteAnimationMode,
  reducedMotion: boolean,
): number {
  return durationForType(event.type, mode, reducedMotion);
}

/** Easing tokens (CSS timing functions) shared by the wheel/ball/camera transitions. */
export const EASING = {
  spinUp: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
  decel: "cubic-bezier(0.12, 0.7, 0.18, 1)", // long ease-out for ball settle
  camera: "cubic-bezier(0.22, 1, 0.36, 1)", // zoom in/out
  bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export function sec(ms: number): string {
  return `${ms / 1000}s`;
}

// ── visualFocus plan (addendum §5.2 / §6) ────────────────────────────────────
// Each event maps to a primary focus, optionally switching to a second focus partway through the
// event (a purely cosmetic mid-event camera move — it does NOT ack). FULL uses the richest path.
export interface FocusPlan {
  focus: RouletteVisualFocus;
  mid?: RouletteVisualFocus;
  /** When (0..1 of the event duration) to switch to `mid`. */
  midAt: number;
}

export function focusPlan(eventType: EventType, mode: RouletteAnimationMode): FocusPlan {
  const full = mode === "full";
  switch (eventType) {
    case "NO_MORE_BETS":
      return { focus: "closingBets", midAt: 1 };
    case "SPIN_START":
      return full ? { focus: "wheelZoomIn", mid: "highSpeedSpin", midAt: 0.34 } : { focus: "highSpeedSpin", midAt: 1 };
    case "BALL_LAND":
      return full ? { focus: "suspenseSpin", mid: "rattleDrop", midAt: 0.5 } : { focus: "highSpeedSpin", midAt: 1 };
    case "MARK_WINNER":
      return { focus: "winnerReveal", mid: "tableReturn", midAt: 0.65 };
    case "COLLECT_LOSING":
    case "PAY_WINNING":
    case "RESULT_BANNER":
      return { focus: "table", midAt: 1 };
  }
}

// ── prefers-reduced-motion (reactive, matches Hold'em) ────────────────────────
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
