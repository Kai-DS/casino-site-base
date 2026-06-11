// components/roulette/rouletteSound.ts
// Addendum §14: a no-op sound seam so audio can be added later without touching the queue.
// v1 plays nothing; the call sites already exist at each event so wiring real samples is a
// one-file change.
import type { AnimationEvent } from "@/games/roulette/types";
import type { RouletteAnimationMode } from "./animationMode";

export function playRouletteSound(
  _eventType: AnimationEvent["type"],
  _mode: RouletteAnimationMode,
): void {
  // v1: intentionally silent. Future: low bell (NO_MORE_BETS), wheel hum (SPIN_START),
  // rolling → clatter (BALL_LAND), hit (MARK_WINNER), chips (PAY_WINNING).
}
