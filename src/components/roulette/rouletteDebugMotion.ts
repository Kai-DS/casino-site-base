import { DEFAULT_ANIMATION_MODE, isAnimationMode, type RouletteAnimationMode } from "./animationMode";
import {
  DEFAULT_MOTION_VARIANT_BY_MODE,
  ROULETTE_MOTION_VARIANTS,
  isRouletteMotionVariantId,
  type RouletteMotionVariantId,
} from "./wheel3dAnimation";

export interface RouletteDebugMotionResolution {
  mode: RouletteAnimationMode;
  variantOverride: RouletteMotionVariantId | null;
}

type RouletteDebugEnv = Pick<ImportMetaEnv, "DEV">;

export function rouletteDebugQueriesEnabled(env: RouletteDebugEnv = import.meta.env): boolean {
  return env.DEV;
}

function variantMode(variantId: RouletteMotionVariantId): Exclude<RouletteAnimationMode, "reduced"> {
  return ROULETTE_MOTION_VARIANTS.find((variant) => variant.id === variantId)!.mode;
}

function defaultVariantForMode(mode: RouletteAnimationMode): RouletteMotionVariantId | null {
  return mode === "reduced" ? null : DEFAULT_MOTION_VARIANT_BY_MODE[mode];
}

export function resolveRouletteDebugMotion(
  uiMode: RouletteAnimationMode,
  query: { rouletteMode?: string | null; rouletteVariant?: string | null },
): RouletteDebugMotionResolution {
  const explicitMode = isAnimationMode(query.rouletteMode) ? query.rouletteMode : null;
  const hasVariantQuery = query.rouletteVariant != null;
  const requestedVariant = isRouletteMotionVariantId(query.rouletteVariant) ? query.rouletteVariant : null;
  const inferredMode = requestedVariant ? variantMode(requestedVariant) : null;
  const mode = explicitMode ?? inferredMode ?? uiMode ?? DEFAULT_ANIMATION_MODE;

  if (!hasVariantQuery) return { mode, variantOverride: null };
  if (requestedVariant && inferredMode === mode) return { mode, variantOverride: requestedVariant };
  return { mode, variantOverride: defaultVariantForMode(mode) };
}

export function readRouletteDebugMotionFromSearch(
  uiMode: RouletteAnimationMode,
  search: string,
  enabled = rouletteDebugQueriesEnabled(),
): RouletteDebugMotionResolution {
  if (!enabled) return { mode: uiMode, variantOverride: null };
  try {
    const params = new URLSearchParams(search);
    return resolveRouletteDebugMotion(uiMode, {
      rouletteMode: params.get("rouletteMode"),
      rouletteVariant: params.get("rouletteVariant"),
    });
  } catch {
    return { mode: uiMode, variantOverride: null };
  }
}

export function rouletteDebugOverlayEnabledFromSearch(
  search: string,
  enabled = rouletteDebugQueriesEnabled(),
): boolean {
  if (!enabled) return false;
  try {
    return new URLSearchParams(search).get("rouletteDebugMotion") === "1";
  } catch {
    return false;
  }
}

export function readRouletteDebugMotionFromLocation(uiMode: RouletteAnimationMode): RouletteDebugMotionResolution {
  if (typeof window === "undefined") return { mode: uiMode, variantOverride: null };
  return readRouletteDebugMotionFromSearch(uiMode, window.location.search);
}

export function readRouletteDebugOverlayFromLocation(): boolean {
  if (typeof window === "undefined") return false;
  return rouletteDebugOverlayEnabledFromSearch(window.location.search);
}
