// games/texasHoldem/components/motion.ts
// Shared motion vocabulary for the Texas Hold'em UI (spec §22.2 tokens + §24 per-event timing).
//
// This repo does not use framer-motion (Video Poker's pseudo-3D is pure CSS too), so the
// spec's SPRING configs are expressed as CSS cubic-bezier approximations. Every component
// imports timing/easing from here — no duration or easing literals are scattered in the UI.
import { useSyncExternalStore } from "react";
import type { AnimationEvent } from "../types";

/** §22.2 duration tokens (ms). */
export const DURATION = {
  fast: 200, // button / hover / label
  normal: 350, // general transition
  slow: 600, // larger transition
  dramatic: 1000, // hand-decided / banner
} as const;

/** §22.2 easing tokens as CSS timing functions. */
export const EASING = {
  entrance: "cubic-bezier(0.16, 1, 0.30, 1)", // ease-out-expo style
  exit: "cubic-bezier(0.7, 0, 0.84, 0)",
  inout: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

/** §22.2 spring tokens → CSS cubic-bezier stand-ins (slight overshoot = "settle"). */
export const SPRING = {
  card: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  chip: "cubic-bezier(0.34, 1.40, 0.64, 1)",
  light: "cubic-bezier(0.22, 1.00, 0.36, 1)",
} as const;

/** Stagger / hold values from §24 (centralised so components never hardcode them). */
export const STAGGER = {
  hole: 80, // §24.2 hole-card deal stagger
  community: 140, // §24.3 community deal/flip stagger
  showdown: 250, // §24.7 showdown reveal stagger
} as const;

/** Community card "deal then flip" timing (left→right). Drives CommunityCards + the flop gate. */
export const COMMUNITY = {
  stagger: 140, // gap between consecutive cards (left→right)
  dealMs: 320, // slide-in (deal) duration per card
  flipOffset: 60, // flip starts this long after the card lands
} as const;

export const HOLD = {
  label: 700, // §24.11 CPU / action label on-screen time
} as const;

/** §24.12 reduced-motion crossfade target. */
const REDUCED_MS = 100;

/**
 * How long the UI holds one AnimationEvent before calling onAnimationEventComplete.
 *
 * NOTE: this is the *completion gate*, not necessarily the on-screen animation length.
 * Because the logic already committed the final state when it queued the event, a card's
 * CSS flight can outlast its gate — e.g. DEAL_HOLE returns the 80ms stagger interval while
 * the card itself keeps settling. That is what makes the deal feel continuous.
 */
export function durationFor(event: AnimationEvent, reducedMotion: boolean): number {
  if (reducedMotion) {
    // Never skip an event (§24.12) — only shorten it.
    return event.type === "CPU_THINKING" ? Math.min(event.ms, 120) : REDUCED_MS;
  }
  switch (event.type) {
    case "POST_BLIND":
      return DURATION.normal;
    case "DEAL_HOLE":
      return STAGGER.hole;
    case "REVEAL_FLOP":
      // 3 cards dealt + flipped left→right within this single event window.
      return 2 * COMMUNITY.stagger + COMMUNITY.dealMs + COMMUNITY.flipOffset + 360;
    case "REVEAL_TURN":
      return COMMUNITY.dealMs + COMMUNITY.flipOffset + 360;
    case "REVEAL_RIVER":
      return DURATION.dramatic;
    case "CPU_THINKING":
      return event.ms;
    case "PLAYER_ACTION_LABEL":
      return HOLD.label;
    case "CHIP_TO_POT":
      return DURATION.normal;
    case "FLIP_HOLE":
      return STAGGER.showdown;
    case "HIGHLIGHT_BEST":
      return DURATION.slow;
    case "AWARD_POT":
      return DURATION.slow;
    case "RESULT_BANNER":
      return DURATION.dramatic;
  }
}

/** ms → CSS seconds string (e.g. 350 → "0.35s"). */
export function sec(ms: number): string {
  return `${ms / 1000}s`;
}

// ── prefers-reduced-motion (reactive) ────────────────────────────────────────
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
