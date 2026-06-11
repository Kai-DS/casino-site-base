// components/roulette/animationMode.ts
// Cinematic addendum §3 / §5: the spin can be played at three intensities and the UI overlays a
// "visualFocus" on top of the logic phase. These are UI-only concepts — the logic layer never
// sees them. The chosen mode is persisted; OS reduced-motion forces `reduced` playback at runtime.

/** standard = tempo (default) · full = cinematic zoom/rattle · reduced = a11y / sandbox short form. */
export type RouletteAnimationMode = "standard" | "full" | "reduced";

/** UI-only "camera" state layered on the AnimationEvent stream (addendum §5). */
export type RouletteVisualFocus =
  | "table"
  | "closingBets"
  | "wheelZoomIn"
  | "highSpeedSpin"
  | "suspenseSpin"
  | "rattleDrop"
  | "winnerReveal"
  | "tableReturn";

export const ROULETTE_ANIMATION_MODE_STORAGE_KEY = "casino-hub:roulette:animation-mode";

const VALID_MODES: ReadonlySet<string> = new Set<RouletteAnimationMode>(["standard", "full", "reduced"]);

export const DEFAULT_ANIMATION_MODE: RouletteAnimationMode = "standard";

export function isAnimationMode(value: unknown): value is RouletteAnimationMode {
  return typeof value === "string" && VALID_MODES.has(value);
}

/** Read the persisted mode, falling back to "standard" on missing/invalid/unavailable storage. */
export function loadAnimationMode(): RouletteAnimationMode {
  try {
    const raw = localStorage.getItem(ROULETTE_ANIMATION_MODE_STORAGE_KEY);
    return isAnimationMode(raw) ? raw : DEFAULT_ANIMATION_MODE;
  } catch {
    return DEFAULT_ANIMATION_MODE;
  }
}

export function saveAnimationMode(mode: RouletteAnimationMode): void {
  try {
    localStorage.setItem(ROULETTE_ANIMATION_MODE_STORAGE_KEY, mode);
  } catch {
    /* private mode / disabled storage — non-fatal */
  }
}

/**
 * The mode actually played, given the user's choice + whether reduced motion is active.
 * OS `prefers-reduced-motion` (or a sandbox override) collapses any choice to `reduced` (§3.3).
 */
export function effectiveAnimationMode(
  mode: RouletteAnimationMode,
  reducedMotion: boolean,
): RouletteAnimationMode {
  return reducedMotion ? "reduced" : mode;
}
