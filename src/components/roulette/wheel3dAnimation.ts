// components/roulette/wheel3dAnimation.ts
// Deterministic pseudo-physics for the 3D wheel. The model is closed-form and time-based: sampling the
// same timestamp returns the same state at 30/60/120fps and after tab-hide jumps. Angles are split into:
//   rotorDeg          world rotor angle
//   relativeDeg       ball angle in rotor-local coordinates
//   ballDeg           rotorDeg + relativeDeg
// The landing first brings relative velocity to 0 (ball captured in the pocket), then briefly carries
// ball+rotor together, then brakes both to a full world-space stop before reporting landed=true.
// Result selection still lives in game logic; this file only maps an already-decided result.number to a
// deterministic visual path.
import { R, SECTOR_DEG, angleOf } from "./wheel3dGeometry";
import type { RouletteAnimationMode } from "./animationMode";

export type WheelMotionPhase = "idle" | "spin" | "land" | "sync" | "final_brake" | "full_stop";
export type PocketAngularStage = "deflector_exit" | "pocket_hop_1" | "pocket_hop_2" | "pocket_hop_3" | "pocket_settle";
export type RouletteMotionVariantId =
  | "standard_direct"
  | "standard_high_hop"
  | "standard_shallow_hit"
  | "full_long_track"
  | "full_suspense_hang"
  | "full_high_deflector"
  | "full_low_fast_settle";

export interface WheelSample {
  rotorDeg: number;
  ballDeg: number;
  /** Ball angle in rotor-local coordinates. This converges monotonically to the winning pocket. */
  relativeDeg: number;
  ballR: number;
  ballY: number;
  /** Ball self-roll (rad) about its radial axis — visualises rolling along the track. */
  ballRoll: number;
  /** Signed world angular velocity of the rotor, in degrees/second. */
  rotorVelocityDegPerSec: number;
  /** Signed world angular velocity of the ball, in degrees/second. */
  ballVelocityDegPerSec: number;
  /** Signed rotor-local angular velocity: ballVelocity - rotorVelocity, in degrees/second. */
  relativeVelocityDegPerSec: number;
  /** High-level phase for tests/instrumentation. */
  phase: WheelMotionPhase;
  /** Rotor-local landing sub-stage while phase === "land"; null outside the capture path. */
  pocketStage: PocketAngularStage | null;
  /** Deterministic per-spin motion variant; null for reduced/idle fallback. */
  variantId: RouletteMotionVariantId | null;
  /** Variant-level impact intensity hint for optional R3F instrumentation. */
  impactStrength: number;
  /** Variant-level roll sign for optional R3F instrumentation. */
  rollDirection: 1 | -1;
  /** Monotonic per-animator spin sequence used by the deterministic shuffle bag. */
  spinSequence: number;
  /** Shuffle-bag index for debug/instrumentation; null outside standard/full variants. */
  motionBagIndex: number | null;
  /** Slot inside the current shuffle bag; null outside standard/full variants. */
  motionBagSlot: number | null;
  /** True once the landing has visually converged (landing && p >= 1), driving BALL_LAND ack. */
  landed: boolean;
}

interface SpinProfile {
  /** Rotor world turns during SPIN_START. Positive means clockwise in the existing wheel convention. */
  rotorTurns: number;
  /** Ball world turns during SPIN_START. Negative means opposite the rotor. */
  ballTurns: number;
  /** Rotor velocity at the spin->land boundary. */
  rotorEndRps: number;
  /** Ball velocity at the spin->land boundary. */
  ballEndRps: number;
}

interface LandProfile {
  /** Preferred rotor-local turns during BALL_LAND; the exact pocket may shift this by <= half a turn. */
  desiredRelativeTurns: number;
  /** Minimum rotor world turns during BALL_LAND before rounding to a whole-turn rest pose. */
  rotorTurns: number;
  /** Rotor and ball world velocity immediately after pocket capture, before final braking. */
  syncRps: number;
  /** Brief time the captured ball is carried by the rotor before braking. */
  syncHoldMs: number;
  /** Shared ball+rotor braking time. Landed=true only after this completes. */
  finalBrakeMs: number;
}

interface MotionProfile {
  spin: SpinProfile;
  land: LandProfile;
  scatterScale: number;
}

interface VariantTimings {
  trackableOrbitMs: number;
  lossOfStabilityMs: number;
  hangMs: number;
  inwardDropMs: number;
  deflectorApproachMs: number;
  hop1Ms: number;
  hop2Ms: number;
  hop3Ms: number;
  settleMs: number;
  syncHoldMs: number;
  finalBrakeMs: number;
}

interface VariantVisual {
  radialKnockScale: number;
  hopScale: number;
  hopStageScales: readonly [number, number, number, number];
  rollScale: number;
  rollDirection: 1 | -1;
  rattleScale: number;
}

export interface RouletteMotionVariant {
  id: RouletteMotionVariantId;
  mode: Exclude<RouletteAnimationMode, "reduced">;
  spin: SpinProfile;
  land: LandProfile;
  scatterScale: number;
  timings: VariantTimings;
  visual: VariantVisual;
}

export const WHEEL_MOTION_PROFILES: Readonly<Record<RouletteAnimationMode, MotionProfile>> = {
  // Keeps the whole spin brisk, but the ball is already trackable by the SPIN_START -> BALL_LAND handoff.
  standard: {
    spin: { rotorTurns: 0.94, ballTurns: -1.78, rotorEndRps: 0.43, ballEndRps: -0.58 },
    land: { desiredRelativeTurns: 1.0, rotorTurns: 1.55, syncRps: 0.22, syncHoldMs: 190, finalBrakeMs: 520 },
    scatterScale: 1,
  },
  // Independent long-form profile: extra duration goes to trackable outer orbit and hang, not a
  // proportional stretch of the pocket-bounce sequence.
  full: {
    spin: { rotorTurns: 3.0, ballTurns: -3.7, rotorEndRps: 0.75, ballEndRps: -0.65 },
    land: { desiredRelativeTurns: 3.2, rotorTurns: 4.0, syncRps: 0.28, syncHoldMs: 300, finalBrakeMs: 700 },
    scatterScale: 1.2,
  },
  // Reduced motion remains short and simple. Speed constraints are intentionally looser here because
  // the event durations are only a few hundred ms and the ball is not meant to be watched physically.
  reduced: {
    spin: { rotorTurns: 0.25, ballTurns: -0.35, rotorEndRps: 0.8, ballEndRps: -0.9 },
    land: { desiredRelativeTurns: 0.75, rotorTurns: 0.25, syncRps: 0, syncHoldMs: 0, finalBrakeMs: 80 },
    scatterScale: 0.12,
  },
} as const;

export const DEFAULT_MOTION_VARIANT_BY_MODE: Readonly<Record<Exclude<RouletteAnimationMode, "reduced">, RouletteMotionVariantId>> = {
  standard: "standard_direct",
  full: "full_long_track",
} as const;

export const ROULETTE_MOTION_VARIANTS: readonly RouletteMotionVariant[] = [
  {
    id: "standard_direct",
    mode: "standard",
    spin: { rotorTurns: 0.94, ballTurns: -1.78, rotorEndRps: 0.43, ballEndRps: -0.58 },
    land: { desiredRelativeTurns: 1.0, rotorTurns: 1.55, syncRps: 0.22, syncHoldMs: 190, finalBrakeMs: 520 },
    scatterScale: 1,
    timings: {
      trackableOrbitMs: 720,
      lossOfStabilityMs: 310,
      hangMs: 360,
      inwardDropMs: 430,
      deflectorApproachMs: 260,
      hop1Ms: 260,
      hop2Ms: 190,
      hop3Ms: 150,
      settleMs: 240,
      syncHoldMs: 190,
      finalBrakeMs: 520,
    },
    visual: { radialKnockScale: 1, hopScale: 1, hopStageScales: [1, 1, 1, 1], rollScale: 1, rollDirection: 1, rattleScale: 1 },
  },
  {
    id: "standard_high_hop",
    mode: "standard",
    spin: { rotorTurns: 1.32, ballTurns: -1.59, rotorEndRps: 0.5, ballEndRps: -0.46 },
    land: { desiredRelativeTurns: 1.35, rotorTurns: 0.6, syncRps: 0.23, syncHoldMs: 180, finalBrakeMs: 500 },
    scatterScale: 1.06,
    timings: {
      trackableOrbitMs: 680,
      lossOfStabilityMs: 300,
      hangMs: 300,
      inwardDropMs: 420,
      deflectorApproachMs: 390,
      hop1Ms: 250,
      hop2Ms: 185,
      hop3Ms: 145,
      settleMs: 230,
      syncHoldMs: 180,
      finalBrakeMs: 500,
    },
    visual: { radialKnockScale: 1.08, hopScale: 1, hopStageScales: [1.45, 0.95, 0.85, 0.8], rollScale: 1.15, rollDirection: 1, rattleScale: 1.08 },
  },
  {
    id: "standard_shallow_hit",
    mode: "standard",
    spin: { rotorTurns: 0.97, ballTurns: -1.79, rotorEndRps: 0.42, ballEndRps: -0.57 },
    land: { desiredRelativeTurns: 1.0, rotorTurns: 1.6, syncRps: 0.21, syncHoldMs: 200, finalBrakeMs: 540 },
    scatterScale: 0.95,
    timings: {
      trackableOrbitMs: 760,
      lossOfStabilityMs: 340,
      hangMs: 440,
      inwardDropMs: 430,
      deflectorApproachMs: 125,
      hop1Ms: 270,
      hop2Ms: 200,
      hop3Ms: 155,
      settleMs: 240,
      syncHoldMs: 200,
      finalBrakeMs: 540,
    },
    visual: { radialKnockScale: 1.38, hopScale: 1, hopStageScales: [0.65, 0.75, 0.75, 0.7], rollScale: 0.92, rollDirection: -1, rattleScale: 0.92 },
  },
  {
    id: "full_long_track",
    mode: "full",
    spin: { rotorTurns: 3.0, ballTurns: -3.7, rotorEndRps: 0.75, ballEndRps: -0.65 },
    land: { desiredRelativeTurns: 3.2, rotorTurns: 4.0, syncRps: 0.28, syncHoldMs: 300, finalBrakeMs: 700 },
    scatterScale: 1.2,
    timings: {
      trackableOrbitMs: 1500,
      lossOfStabilityMs: 650,
      hangMs: 1100,
      inwardDropMs: 1000,
      deflectorApproachMs: 940,
      hop1Ms: 300,
      hop2Ms: 220,
      hop3Ms: 160,
      settleMs: 280,
      syncHoldMs: 300,
      finalBrakeMs: 700,
    },
    visual: { radialKnockScale: 1, hopScale: 1, hopStageScales: [1, 1, 1, 1], rollScale: 1, rollDirection: 1, rattleScale: 1.08 },
  },
  {
    id: "full_suspense_hang",
    mode: "full",
    spin: { rotorTurns: 3.05, ballTurns: -3.72, rotorEndRps: 0.72, ballEndRps: -0.63 },
    land: { desiredRelativeTurns: 3.15, rotorTurns: 4.0, syncRps: 0.27, syncHoldMs: 330, finalBrakeMs: 680 },
    scatterScale: 1.16,
    timings: {
      trackableOrbitMs: 1360,
      lossOfStabilityMs: 760,
      hangMs: 1450,
      inwardDropMs: 900,
      deflectorApproachMs: 700,
      hop1Ms: 290,
      hop2Ms: 215,
      hop3Ms: 155,
      settleMs: 280,
      syncHoldMs: 330,
      finalBrakeMs: 680,
    },
    visual: { radialKnockScale: 0.96, hopScale: 1, hopStageScales: [0.92, 0.92, 0.9, 0.9], rollScale: 0.95, rollDirection: -1, rattleScale: 1 },
  },
  {
    id: "full_high_deflector",
    mode: "full",
    spin: { rotorTurns: 2.95, ballTurns: -3.64, rotorEndRps: 0.76, ballEndRps: -0.66 },
    land: { desiredRelativeTurns: 3.2, rotorTurns: 4.0, syncRps: 0.29, syncHoldMs: 290, finalBrakeMs: 710 },
    scatterScale: 1.28,
    timings: {
      trackableOrbitMs: 1420,
      lossOfStabilityMs: 620,
      hangMs: 950,
      inwardDropMs: 1000,
      deflectorApproachMs: 1060,
      hop1Ms: 315,
      hop2Ms: 225,
      hop3Ms: 165,
      settleMs: 285,
      syncHoldMs: 290,
      finalBrakeMs: 710,
    },
    visual: { radialKnockScale: 1.16, hopScale: 1, hopStageScales: [1.18, 1.05, 0.95, 0.9], rollScale: 1.14, rollDirection: 1, rattleScale: 1.12 },
  },
  {
    id: "full_low_fast_settle",
    mode: "full",
    spin: { rotorTurns: 3.02, ballTurns: -3.68, rotorEndRps: 0.74, ballEndRps: -0.64 },
    land: { desiredRelativeTurns: 3.15, rotorTurns: 4.0, syncRps: 0.27, syncHoldMs: 280, finalBrakeMs: 650 },
    scatterScale: 1.1,
    timings: {
      trackableOrbitMs: 1460,
      lossOfStabilityMs: 600,
      hangMs: 1050,
      inwardDropMs: 950,
      deflectorApproachMs: 1165,
      hop1Ms: 285,
      hop2Ms: 210,
      hop3Ms: 150,
      settleMs: 260,
      syncHoldMs: 280,
      finalBrakeMs: 650,
    },
    visual: { radialKnockScale: 1.14, hopScale: 1, hopStageScales: [0.78, 0.82, 0.8, 0.75], rollScale: 0.86, rollDirection: -1, rattleScale: 0.88 },
  },
] as const;

const VARIANT_BY_ID = new Map<RouletteMotionVariantId, RouletteMotionVariant>(
  ROULETTE_MOTION_VARIANTS.map((variant) => [variant.id, variant]),
);

function stableHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function isRouletteMotionVariantId(value: unknown): value is RouletteMotionVariantId {
  return typeof value === "string" && VARIANT_BY_ID.has(value as RouletteMotionVariantId);
}

export function rouletteMotionVariantsForMode(mode: RouletteAnimationMode): readonly RouletteMotionVariant[] {
  if (mode === "reduced") return [];
  return ROULETTE_MOTION_VARIANTS.filter((variant) => variant.mode === mode);
}

function defaultVariantForMode(mode: Exclude<RouletteAnimationMode, "reduced">): RouletteMotionVariant {
  return VARIANT_BY_ID.get(DEFAULT_MOTION_VARIANT_BY_MODE[mode])!;
}

function shuffledVariantBag(mode: Exclude<RouletteAnimationMode, "reduced">, seed: string | number, bagIndex: number): readonly RouletteMotionVariant[] {
  const variants = [...rouletteMotionVariantsForMode(mode)];
  for (let i = variants.length - 1; i > 0; i -= 1) {
    const j = stableHash(`${mode}:${seed}:bag:${bagIndex}:slot:${i}`) % (i + 1);
    const tmp = variants[i]!;
    variants[i] = variants[j]!;
    variants[j] = tmp;
  }

  if (bagIndex > 0 && variants.length > 1) {
    const previous = shuffledVariantBag(mode, seed, bagIndex - 1);
    const previousLast = previous[previous.length - 1]?.id;
    if (variants[0]?.id === previousLast) {
      const swapIndex = variants.findIndex((variant) => variant.id !== previousLast);
      if (swapIndex > 0) {
        const tmp = variants[0]!;
        variants[0] = variants[swapIndex]!;
        variants[swapIndex] = tmp;
      }
    }
  }

  return variants;
}

export function rouletteMotionVariantSequence(
  mode: RouletteAnimationMode,
  seed: string | number,
  count: number,
): readonly (RouletteMotionVariantId | null)[] {
  if (mode === "reduced") return Array.from({ length: count }, () => null);
  return Array.from({ length: count }, (_, i) => chooseRouletteMotionVariant(mode, seed, null, i + 1)?.id ?? null);
}

export function chooseRouletteMotionVariant(
  mode: RouletteAnimationMode,
  seed: string | number,
  overrideId: string | null = null,
  spinSeq = 1,
): RouletteMotionVariant | null {
  if (mode === "reduced") return null;
  if (overrideId != null) {
    const forced = isRouletteMotionVariantId(overrideId) ? VARIANT_BY_ID.get(overrideId)! : null;
    return forced?.mode === mode ? forced : defaultVariantForMode(mode);
  }
  const bagSize = rouletteMotionVariantsForMode(mode).length;
  const safeSeq = Math.max(1, Math.floor(spinSeq));
  const bagIndex = Math.floor((safeSeq - 1) / bagSize);
  const slot = (safeSeq - 1) % bagSize;
  return shuffledVariantBag(mode, seed, bagIndex)[slot] ?? defaultVariantForMode(mode);
}

const DEG = 360;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoother = (t: number) => {
  const p = clamp01(t);
  return p * p * p * (p * (p * 6 - 15) + 10);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const turnsToDeg = (turns: number) => turns * DEG;
const rpsToDeg = (rps: number) => rps * DEG;
const norm = (deg: number) => ((deg % DEG) + DEG) % DEG;

/** Tiny, fast, reproducible PRNG (mulberry32) so each spin's path varies but is seedable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface HermiteSeg {
  base: number;
  target: number;
  start: number;
  dur: number;
  v0: number; // deg/sec or units/sec
  v1: number; // deg/sec or units/sec
}

const makeSeg = (base: number, target: number, start: number, dur: number, v0: number, v1: number): HermiteSeg => ({
  base,
  target,
  start,
  dur: Math.max(1, dur),
  v0,
  v1,
});

function segP(s: HermiteSeg, now: number): number {
  return clamp01((now - s.start) / s.dur);
}

function sampleSeg(s: HermiteSeg, now: number): number {
  const p = segP(s, now);
  const p2 = p * p;
  const p3 = p2 * p;
  const T = s.dur / 1000;
  return (
    (2 * p3 - 3 * p2 + 1) * s.base +
    (p3 - 2 * p2 + p) * T * s.v0 +
    (-2 * p3 + 3 * p2) * s.target +
    (p3 - p2) * T * s.v1
  );
}

function sampleSegVelocity(s: HermiteSeg, now: number): number {
  const p = segP(s, now);
  const p2 = p * p;
  const T = s.dur / 1000;
  const dxDp =
    (6 * p2 - 6 * p) * s.base +
    (3 * p2 - 4 * p + 1) * T * s.v0 +
    (-6 * p2 + 6 * p) * s.target +
    (3 * p2 - 2 * p) * T * s.v1;
  return dxDp / T;
}

function makeDirectionalSeg(base: number, target: number, start: number, dur: number, v0: number, v1: number, direction: 1 | -1): HermiteSeg {
  let endVelocity = v1;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const seg = makeSeg(base, target, start, dur, v0, endVelocity);
    let monotone = true;
    for (let i = 0; i <= 48; i += 1) {
      const v = sampleSegVelocity(seg, start + (seg.dur * i) / 48);
      if (v * direction < -1e-6) {
        monotone = false;
        break;
      }
    }
    if (monotone) return seg;
    endVelocity *= 0.5;
  }
  return makeSeg(base, target, start, dur, v0, 0);
}

function wholeTurnTarget(current: number, minTurns: number): number {
  return Math.ceil((current + turnsToDeg(minTurns)) / DEG) * DEG;
}

function landTiming(profile: LandProfile, totalMs: number) {
  let finalBrakeMs = Math.min(profile.finalBrakeMs, totalMs * 0.3);
  let syncHoldMs = Math.min(profile.syncHoldMs, totalMs * 0.12);
  const minCaptureMs = Math.min(80, totalMs);
  const spare = totalMs - minCaptureMs;
  const tail = finalBrakeMs + syncHoldMs;
  if (tail > spare && tail > 0) {
    const scale = Math.max(0, spare) / tail;
    finalBrakeMs *= scale;
    syncHoldMs *= scale;
  }
  return {
    captureMs: Math.max(minCaptureMs, totalMs - finalBrakeMs - syncHoldMs),
    syncHoldMs,
    finalBrakeMs,
  };
}

export const POCKET_HOP_BUDGETS = {
  hop1Pockets: 3.6,
  hop2Pockets: 1.45,
  hop3Pockets: 0.75,
  settlePockets: 0.18,
} as const;

const POCKET_STAGE_BASE_MS: Readonly<Record<RouletteAnimationMode, Record<Exclude<PocketAngularStage, "deflector_exit">, number>>> = {
  standard: {
    pocket_hop_1: 240,
    pocket_hop_2: 180,
    pocket_hop_3: 140,
    pocket_settle: 220,
  },
  full: {
    pocket_hop_1: 300,
    pocket_hop_2: 220,
    pocket_hop_3: 160,
    pocket_settle: 280,
  },
  reduced: {
    pocket_hop_1: 24,
    pocket_hop_2: 18,
    pocket_hop_3: 14,
    pocket_settle: 24,
  },
} as const;

const POCKET_STAGE_ORDER = ["pocket_hop_1", "pocket_hop_2", "pocket_hop_3", "pocket_settle"] as const;

export interface PocketStageWindow {
  stage: PocketAngularStage;
  startMs: number;
  durationMs: number;
  endMs: number;
}

function pocketStageDistancesDeg(): Record<Exclude<PocketAngularStage, "deflector_exit">, number> {
  return {
    pocket_hop_1: POCKET_HOP_BUDGETS.hop1Pockets * SECTOR_DEG,
    pocket_hop_2: POCKET_HOP_BUDGETS.hop2Pockets * SECTOR_DEG,
    pocket_hop_3: POCKET_HOP_BUDGETS.hop3Pockets * SECTOR_DEG,
    pocket_settle: POCKET_HOP_BUDGETS.settlePockets * SECTOR_DEG,
  };
}

function pocketStageDurations(
  mode: RouletteAnimationMode,
  captureMs: number,
  variant: RouletteMotionVariant | null = null,
): Record<Exclude<PocketAngularStage, "deflector_exit">, number> {
  const base = variant
    ? {
        pocket_hop_1: variant.timings.hop1Ms,
        pocket_hop_2: variant.timings.hop2Ms,
        pocket_hop_3: variant.timings.hop3Ms,
        pocket_settle: variant.timings.settleMs,
      }
    : POCKET_STAGE_BASE_MS[mode];
  const baseTotal = POCKET_STAGE_ORDER.reduce((sum, stage) => sum + base[stage], 0);
  const minDeflectorMs = Math.min(80, Math.max(20, captureMs * 0.25));
  const maxPocketTotal = Math.max(POCKET_STAGE_ORDER.length, captureMs - minDeflectorMs);
  const scale = Math.min(1, maxPocketTotal / baseTotal);
  return {
    pocket_hop_1: Math.max(1, base.pocket_hop_1 * scale),
    pocket_hop_2: Math.max(1, base.pocket_hop_2 * scale),
    pocket_hop_3: Math.max(1, base.pocket_hop_3 * scale),
    pocket_settle: Math.max(1, base.pocket_settle * scale),
  };
}

export function pocketStageWindows(mode: RouletteAnimationMode, captureMs: number, variantId: RouletteMotionVariantId | null = null): PocketStageWindow[] {
  const variant = variantId && isRouletteMotionVariantId(variantId) ? VARIANT_BY_ID.get(variantId)! : null;
  const durations = pocketStageDurations(mode, captureMs, variant?.mode === mode ? variant : null);
  const pocketTotal = POCKET_STAGE_ORDER.reduce((sum, stage) => sum + durations[stage], 0);
  const deflector = Math.max(1, captureMs - pocketTotal);
  const out: PocketStageWindow[] = [{ stage: "deflector_exit", startMs: 0, durationMs: deflector, endMs: deflector }];
  let cursor = deflector;
  for (const stage of POCKET_STAGE_ORDER) {
    const durationMs = durations[stage];
    out.push({ stage, startMs: cursor, durationMs, endMs: cursor + durationMs });
    cursor += durationMs;
  }
  return out;
}

interface LandParams {
  radialAmp: number;
  radialPhase: number;
  hopAmp: number;
  bounceCenters: readonly number[];
  bounceWidths: readonly number[];
  path: LandPath;
  radialKnockScale: number;
  hopScale: number;
  hopStageScales: readonly [number, number, number, number];
  rollScale: number;
  rollDirection: 1 | -1;
  impactStrength: number;
}

interface LandPath {
  hangEndP: number;
  inwardEndP: number;
  pocketEndP: number;
  deflectorCenterP: number;
  deflectorWidthP: number;
}

interface BaseState {
  rotorDeg: number;
  relativeDeg: number;
  rotorVelocityDegPerSec: number;
  relativeVelocityDegPerSec: number;
  phase: WheelMotionPhase;
  pocketStage: PocketAngularStage | null;
  landed: boolean;
}

// ── endgame choreography (spec §17): the gross inward path (radius/height) + the staged pocket bounces.
// These are COSMETIC: they shape ballR/ballY/ballRoll only — never the angle, relative velocity, profiles
// or the result pocket. Everything is a pure function of the land progress p (FPS-independent) and decays
// to exactly 0 by p=1, so the ball settles flush at R.ballRestR / R.ballRestY regardless of seed.

/** Legacy/default staged pocket-bounce centers (fraction of capture). Runtime centers come from pocketStageWindows(). */
export const BOUNCE_STAGE_CENTERS = [0.5, 0.66, 0.79, 0.89] as const;
/** Rapidly-decaying bounce gains. Encodes spec §17.4: stage2<=50%, stage3<=25%, stage4<=10% of stage1.
 *  No even decay, no rubber-ball repetition — the bounce range collapses 3-4 -> 1-2 -> adjacent -> in-pocket. */
export const BOUNCE_STAGE_GAINS = [1, 0.45, 0.22, 0.08] as const;
const BOUNCE_WIDTH = 0.05;
const DEFLECTOR_CENTER = 0.45;
const DEFLECTOR_WIDTH = 0.06;
const DEFAULT_LAND_PATH: LandPath = {
  hangEndP: 0.2,
  inwardEndP: 0.46,
  pocketEndP: 0.74,
  deflectorCenterP: DEFLECTOR_CENTER,
  deflectorWidthP: DEFLECTOR_WIDTH,
};
/** Gaussian pulse — a localized, smooth bump centered at c with half-width w. */
const lobe = (p: number, c: number, w: number) => {
  const x = (p - c) / w;
  return Math.exp(-(x * x));
};

/** Gross radius path: hang near the outer track -> fall inward across the apron -> into the pocket -> flush. */
function landRadius(p: number, path: LandPath): number {
  if (p < path.hangEndP) return mix(R.ballOrbitR, R.ballOrbitR - 0.06, smoother(p / path.hangEndP)); // hang: hair of inward creep
  if (p < path.inwardEndP) return mix(R.ballOrbitR - 0.06, R.apronInnerR, smoother((p - path.hangEndP) / (path.inwardEndP - path.hangEndP))); // inward drop
  if (p < path.pocketEndP) return mix(R.apronInnerR, R.ballRestR + 0.18, smoother((p - path.inwardEndP) / (path.pocketEndP - path.inwardEndP))); // into pocket band
  return mix(R.ballRestR + 0.18, R.ballRestR, smoother((p - path.pocketEndP) / (1 - path.pocketEndP))); // settle flush
}

/** Gross height path: ride high (small dip) -> drop to the deflectors -> down to the floor -> rest. */
function landHeight(p: number, path: LandPath): number {
  const heightHangEnd = Math.min(path.inwardEndP - 0.04, path.hangEndP + 0.02);
  const floorApproachEnd = Math.min(0.88, path.pocketEndP + 0.04);
  if (p < heightHangEnd) return mix(R.ballSpinY, R.ballSpinY - 0.05, smoother(p / heightHangEnd)); // hang: small dip
  if (p < path.inwardEndP) return mix(R.ballSpinY - 0.05, R.deflectorY + 0.06, smoother((p - heightHangEnd) / (path.inwardEndP - heightHangEnd))); // fall
  if (p < floorApproachEnd) return mix(R.deflectorY + 0.06, R.ballRestY + 0.06, smoother((p - path.inwardEndP) / (floorApproachEnd - path.inwardEndP))); // to floor
  return mix(R.ballRestY + 0.06, R.ballRestY, smoother((p - floorApproachEnd) / (1 - floorApproachEnd))); // settle
}

/** Staged bounce overlay: one outward deflector knock, then the collapsing pocket bounces. dR/dY/roll all
 *  ride the gross path above and are 0 outside (0.3, 0.985) — so the settle is exact at p=1. Seeded only in
 *  amplitude/phase (radius+height rattle), never in the angle. */
function landBounce(p: number, lp: LandParams): { dR: number; dY: number; roll: number } {
  if (p <= 0.3 || p >= 0.985) return { dR: 0, dY: 0, roll: 0 };
  let dR = lp.radialAmp * 1.25 * lp.radialKnockScale * lobe(p, lp.path.deflectorCenterP, lp.path.deflectorWidthP); // outward knock off the diamond
  let dY = 0;
  let roll = 0;
  for (let i = 0; i < lp.bounceCenters.length; i += 1) {
    const g = BOUNCE_STAGE_GAINS[i]!;
    const s = lobe(p, lp.bounceCenters[i]!, lp.bounceWidths[i] ?? BOUNCE_WIDTH);
    dY += lp.hopAmp * lp.hopScale * (lp.hopStageScales[i] ?? 1) * g * s; // upward hops, shrinking per stage
    dR += lp.radialAmp * 0.7 * lp.radialKnockScale * g * s * Math.cos(lp.radialPhase + i * 2.39); // in/out knocks at the frets
    roll += 0.4 * lp.rollScale * lp.rollDirection * g * s * (i % 2 === 0 ? 1 : -1); // short attitude jitter, decays per stage
  }
  return { dR, dY, roll };
}

/** Test/instrumentation hook: the staged bounce overlay (dR/dY/roll) as a pure function of land progress
 *  p and the seeded amplitudes. Exposed so the §17.4 collapse contract can be asserted directly. */
export function pocketBounceOverlay(p: number, radialAmp: number, hopAmp: number, radialPhase = 0) {
  return landBounce(p, {
    radialAmp,
    radialPhase,
    hopAmp,
    bounceCenters: BOUNCE_STAGE_CENTERS,
    bounceWidths: BOUNCE_STAGE_CENTERS.map(() => BOUNCE_WIDTH),
    path: DEFAULT_LAND_PATH,
    radialKnockScale: 1,
    hopScale: 1,
    hopStageScales: [1, 1, 1, 1],
    rollScale: 1,
    rollDirection: 1,
    impactStrength: 1,
  });
}

function landPathFor(captureMs: number, pocketWindows: readonly PocketStageWindow[], variant: RouletteMotionVariant | null): LandPath {
  if (!variant) return DEFAULT_LAND_PATH;
  const prePocketMs = Math.max(1, pocketWindows[0]?.durationMs ?? captureMs * 0.55);
  const hangMs = Math.min(variant.timings.hangMs, prePocketMs * 0.58);
  const inwardMs = Math.min(variant.timings.inwardDropMs, Math.max(1, prePocketMs - hangMs) * 0.72);
  const hangEndP = Math.max(0.12, Math.min(0.48, hangMs / captureMs));
  const inwardEndP = Math.max(hangEndP + 0.12, Math.min(0.72, (hangMs + inwardMs) / captureMs));
  const hop1 = pocketWindows.find((w) => w.stage === "pocket_hop_1")?.durationMs ?? variant.timings.hop1Ms;
  const hop2 = pocketWindows.find((w) => w.stage === "pocket_hop_2")?.durationMs ?? variant.timings.hop2Ms;
  const hop3 = pocketWindows.find((w) => w.stage === "pocket_hop_3")?.durationMs ?? variant.timings.hop3Ms;
  const pocketEndP = Math.max(inwardEndP + 0.08, Math.min(0.9, (prePocketMs + hop1 + hop2 + hop3 * 0.5) / captureMs));
  const impactCenterMs = Math.max(hangMs + inwardMs + 1, prePocketMs - variant.timings.deflectorApproachMs * 0.35);
  const deflectorCenterP = Math.max(inwardEndP + 0.02, Math.min(pocketEndP - 0.02, impactCenterMs / captureMs));
  const deflectorWidthP = Math.max(0.035, Math.min(0.08, (variant.timings.deflectorApproachMs / captureMs) * 0.18));
  return {
    hangEndP,
    inwardEndP,
    pocketEndP,
    deflectorCenterP,
    deflectorWidthP,
  };
}

interface RelativeStage {
  kind: PocketAngularStage;
  seg: HermiteSeg;
}

function totalPocketBudgetDeg(): number {
  const d = pocketStageDistancesDeg();
  return d.pocket_hop_1 + d.pocket_hop_2 + d.pocket_hop_3 + d.pocket_settle;
}

function isMonotoneBounded(seg: HermiteSeg, direction: 1 | -1, maxAbsVelocity: number, samples: number): { monotone: boolean; bounded: boolean } {
  let monotone = true;
  let bounded = true;
  for (let i = 0; i <= samples; i += 1) {
    const v = sampleSegVelocity(seg, seg.start + (seg.dur * i) / samples);
    if (v * direction < -1e-6) monotone = false;
    if (Math.abs(v) > maxAbsVelocity + 1e-6) bounded = false;
  }
  return { monotone, bounded };
}

function chooseStagedRelativeTarget(
  currentLocal: number,
  targetMod: number,
  desiredTurns: number,
  startVelocityDegPerSec: number,
  deflectorMs: number,
  pocketBudgetDeg: number,
  pocketStartVelocityDegPerSec: number,
): number {
  let fallback = currentLocal - turnsToDeg(Math.max(0.25, desiredTurns));
  let fallbackScore = Number.POSITIVE_INFINITY;
  let monotoneBest = fallback;
  let monotoneBestScore = Number.POSITIVE_INFINITY;
  let best = fallback;
  let bestScore = Number.POSITIVE_INFINITY;
  const maxAllowed = Math.max(Math.abs(startVelocityDegPerSec) * 1.05, Math.abs(startVelocityDegPerSec) + 1e-6);

  for (let k = -240; k <= 240; k += 1) {
    const target = norm(targetMod) + k * DEG;
    const totalDelta = currentLocal - target;
    const deflectorDelta = totalDelta - pocketBudgetDeg;
    if (deflectorDelta <= 1e-6) continue;
    const pocketStart = target + pocketBudgetDeg;
    const turns = totalDelta / DEG;
    const score = Math.abs(turns - desiredTurns);
    if (score < fallbackScore) {
      fallback = target;
      fallbackScore = score;
    }

    const seg = makeSeg(currentLocal, pocketStart, 0, deflectorMs, startVelocityDegPerSec, pocketStartVelocityDegPerSec);
    const { monotone, bounded } = isMonotoneBounded(seg, -1, maxAllowed, 72);
    if (!monotone) continue;
    if (score < monotoneBestScore) {
      monotoneBest = target;
      monotoneBestScore = score;
    }
    if (bounded && score < bestScore) {
      best = target;
      bestScore = score;
    }
  }

  if (Number.isFinite(bestScore)) return best;
  return Number.isFinite(monotoneBestScore) ? monotoneBest : fallback;
}

function buildRelativeStages(
  mode: RouletteAnimationMode,
  startDeg: number,
  finalDeg: number,
  startMs: number,
  captureMs: number,
  startVelocityDegPerSec: number,
  variant: RouletteMotionVariant | null,
): RelativeStage[] {
  const windows = pocketStageWindows(mode, captureMs, variant?.id ?? null);
  const durations = pocketStageDurations(mode, captureMs, variant);
  const distances = pocketStageDistancesDeg();
  const slopes = POCKET_STAGE_ORDER.map((stage) => -distances[stage] / (durations[stage] / 1000));
  const boundaryVelocity = (a: number, b: number) => -Math.min(Math.abs(a), Math.abs(b));
  const velocities = [
    slopes[0]! * 1.25,
    boundaryVelocity(slopes[0]!, slopes[1]!),
    boundaryVelocity(slopes[1]!, slopes[2]!),
    boundaryVelocity(slopes[2]!, slopes[3]!),
    0,
  ];

  const settleStart = finalDeg + distances.pocket_settle;
  const hop3Start = settleStart + distances.pocket_hop_3;
  const hop2Start = hop3Start + distances.pocket_hop_2;
  const hop1Start = hop2Start + distances.pocket_hop_1;
  const targets: Record<PocketAngularStage, number> = {
    deflector_exit: hop1Start,
    pocket_hop_1: hop2Start,
    pocket_hop_2: hop3Start,
    pocket_hop_3: settleStart,
    pocket_settle: finalDeg,
  };

  const stages: RelativeStage[] = [];
  let prevDeg = startDeg;
  let prevVelocity = startVelocityDegPerSec;
  let pocketVelocityIndex = 0;
  for (const win of windows) {
    const nextVelocity = win.stage === "deflector_exit" ? velocities[0]! : velocities[pocketVelocityIndex + 1]!;
    stages.push({
      kind: win.stage,
      seg: makeSeg(prevDeg, targets[win.stage], startMs + win.startMs, win.durationMs, prevVelocity, nextVelocity),
    });
    prevDeg = targets[win.stage];
    prevVelocity = nextVelocity;
    if (win.stage !== "deflector_exit") pocketVelocityIndex += 1;
  }
  return stages;
}

export class WheelAnimator {
  private rotor: HermiteSeg = makeSeg(0, 0, 0, 1, 0, 0);
  private relative: HermiteSeg = makeSeg(0, 0, 0, 1, 0, 0);
  private relativeStages: RelativeStage[] = [];
  private brake: HermiteSeg = makeSeg(0, 0, 0, 1, 0, 0);
  private rotorDeg = 0;
  private relativeDeg = 0;
  private finalRelativeDeg = 0;
  private phase: WheelMotionPhase = "idle";
  private landStart = 0;
  private landDur = 1;
  private captureEnd = 0;
  private syncEnd = 0;
  private landEnd = 0;
  private finalRotorDeg = 0;
  private forced = false;
  private spinSeq = 0;
  private seedOverride: number | null = null;
  private motionVariantOverride: string | null = null;
  private activeVariant: RouletteMotionVariant | null = null;
  private activeBagIndex: number | null = null;
  private activeBagSlot: number | null = null;
  private syncVelocityDegPerSec = 0;
  private lp: LandParams = {
    radialAmp: 0,
    radialPhase: 0,
    hopAmp: 0,
    bounceCenters: BOUNCE_STAGE_CENTERS,
    bounceWidths: BOUNCE_STAGE_CENTERS.map(() => BOUNCE_WIDTH),
    path: DEFAULT_LAND_PATH,
    radialKnockScale: 1,
    hopScale: 1,
    hopStageScales: [1, 1, 1, 1],
    rollScale: 1,
    rollDirection: 1,
    impactStrength: 1,
  };

  /** Inject a fixed seed (tests/repro). Cleared by passing null. */
  setSeed(seed: number | null) {
    this.seedOverride = seed;
  }

  /** Debug/test hook: force one predefined motion variant. Invalid ids fall back to the mode default. */
  setMotionVariantOverride(variantId: string | null) {
    this.motionVariantOverride = variantId;
  }

  getMotionVariantId(): RouletteMotionVariantId | null {
    return this.activeVariant?.id ?? null;
  }

  getSpinSequence(): number {
    return this.spinSeq;
  }

  /** Force-finalize: the next sample returns the exact p=1 state. */
  forceFinalize() {
    if (this.phase === "land") this.forced = true;
  }

  startSpin(mode: RouletteAnimationMode, spinMs: number, now: number) {
    const cur = this.baseState(now);
    this.phase = "spin";
    this.forced = false;
    this.relativeStages = [];
    this.spinSeq += 1;
    const bagSize = Math.max(1, rouletteMotionVariantsForMode(mode).length);
    this.activeBagIndex = mode === "reduced" ? null : Math.floor((this.spinSeq - 1) / bagSize);
    this.activeBagSlot = mode === "reduced" ? null : (this.spinSeq - 1) % bagSize;
    this.activeVariant = chooseRouletteMotionVariant(mode, this.seedOverride ?? 0x9e3779b9, this.motionVariantOverride, this.spinSeq);
    const profile = (this.activeVariant?.spin ?? WHEEL_MOTION_PROFILES[mode].spin);
    this.rotor = makeSeg(
      cur.rotorDeg,
      cur.rotorDeg + turnsToDeg(profile.rotorTurns),
      now,
      spinMs,
      0,
      rpsToDeg(profile.rotorEndRps),
    );
    this.relative = makeDirectionalSeg(
      cur.relativeDeg,
      cur.relativeDeg + turnsToDeg(profile.ballTurns - profile.rotorTurns),
      now,
      spinMs,
      0,
      rpsToDeg(profile.ballEndRps - profile.rotorEndRps),
      -1,
    );
  }

  startLand(landedNumber: number, mode: RouletteAnimationMode, landMs: number, now: number) {
    const cur = this.baseState(now);
    if (mode === "reduced") {
      this.activeVariant = null;
      this.activeBagIndex = null;
      this.activeBagSlot = null;
    } else if (!this.activeVariant || this.activeVariant.mode !== mode) {
      const bagSize = Math.max(1, rouletteMotionVariantsForMode(mode).length);
      this.activeBagIndex = Math.floor((Math.max(1, this.spinSeq) - 1) / bagSize);
      this.activeBagSlot = (Math.max(1, this.spinSeq) - 1) % bagSize;
      this.activeVariant = chooseRouletteMotionVariant(mode, this.seedOverride ?? 0x9e3779b9, this.motionVariantOverride, Math.max(1, this.spinSeq));
    }
    const variant = this.activeVariant;
    const profile: MotionProfile = variant
      ? { spin: variant.spin, land: variant.land, scatterScale: variant.scatterScale }
      : WHEEL_MOTION_PROFILES[mode];
    this.phase = "land";
    this.forced = false;
    this.landStart = now;
    this.landDur = Math.max(80, landMs);
    const timing = landTiming(profile.land, this.landDur);
    this.captureEnd = now + timing.captureMs;
    this.syncEnd = this.captureEnd + timing.syncHoldMs;
    this.landEnd = now + this.landDur;
    this.syncVelocityDegPerSec = rpsToDeg(profile.land.syncRps);

    const finalRotorTarget = wholeTurnTarget(cur.rotorDeg, profile.land.rotorTurns);
    this.finalRotorDeg = finalRotorTarget;
    const syncHoldDelta = this.syncVelocityDegPerSec * (timing.syncHoldMs / 1000);
    const brakeDelta = this.syncVelocityDegPerSec * (timing.finalBrakeMs / 1000) * 0.5;
    const rotorCaptureTarget = finalRotorTarget - syncHoldDelta - brakeDelta;
    const brakeStart = rotorCaptureTarget + syncHoldDelta;
    const pocketWindows = pocketStageWindows(mode, timing.captureMs, variant?.id ?? null);
    const pocketDurations = pocketStageDurations(mode, timing.captureMs, variant);
    const pocketDistances = pocketStageDistancesDeg();
    const hop1Slope = -pocketDistances.pocket_hop_1 / (pocketDurations.pocket_hop_1 / 1000);
    const relativeTarget = chooseStagedRelativeTarget(
      cur.relativeDeg,
      angleOf(landedNumber),
      profile.land.desiredRelativeTurns,
      cur.relativeVelocityDegPerSec,
      pocketWindows[0]!.durationMs,
      totalPocketBudgetDeg(),
      hop1Slope * 1.25,
    );
    this.finalRelativeDeg = relativeTarget;
    this.rotor = makeSeg(cur.rotorDeg, rotorCaptureTarget, now, timing.captureMs, cur.rotorVelocityDegPerSec, this.syncVelocityDegPerSec);
    this.relativeStages = buildRelativeStages(mode, cur.relativeDeg, relativeTarget, now, timing.captureMs, cur.relativeVelocityDegPerSec, variant);
    this.relative = this.relativeStages[this.relativeStages.length - 1]?.seg ?? makeSeg(cur.relativeDeg, relativeTarget, now, timing.captureMs, cur.relativeVelocityDegPerSec, 0);
    this.brake = makeSeg(brakeStart, finalRotorTarget, this.syncEnd, Math.max(1, timing.finalBrakeMs), this.syncVelocityDegPerSec, 0);

    const seed = this.seedOverride ?? (this.spinSeq * 2654435761 + landedNumber * 40503 + 0x9e37) >>> 0;
    const rng = mulberry32(seed);
    const scale = profile.scatterScale;
    const visual: VariantVisual = variant?.visual ?? { radialKnockScale: 1, hopScale: 1, hopStageScales: [1, 1, 1, 1], rollScale: 1, rollDirection: 1, rattleScale: 1 };
    this.lp = {
      radialAmp: (0.06 + rng() * 0.05) * scale * visual.rattleScale,
      radialPhase: rng() * Math.PI * 2,
      hopAmp: (0.1 + rng() * 0.06) * scale * visual.rattleScale,
      bounceCenters: pocketWindows.slice(1).map((w) => (w.startMs + w.durationMs * 0.5) / timing.captureMs),
      bounceWidths: pocketWindows.slice(1).map((w) => Math.max(0.018, Math.min(0.05, (w.durationMs / timing.captureMs) * 0.35))),
      path: landPathFor(timing.captureMs, pocketWindows, variant),
      radialKnockScale: visual.radialKnockScale,
      hopScale: visual.hopScale,
      hopStageScales: visual.hopStageScales,
      rollScale: visual.rollScale,
      rollDirection: visual.rollDirection,
      impactStrength: visual.radialKnockScale * visual.hopScale,
    };
  }

  reset() {
    const cur = this.baseState(this.landEnd || 0);
    this.phase = "idle";
    this.forced = false;
    this.syncVelocityDegPerSec = 0;
    this.rotorDeg = cur.rotorDeg;
    this.relativeDeg = cur.relativeDeg;
    this.finalRelativeDeg = cur.relativeDeg;
    this.relativeStages = [];
    this.activeVariant = null;
    this.activeBagIndex = null;
    this.activeBagSlot = null;
    this.rotor = makeSeg(this.rotorDeg, this.rotorDeg, 0, 1, 0, 0);
    this.relative = makeSeg(this.relativeDeg, this.relativeDeg, 0, 1, 0, 0);
  }

  sample(now: number): WheelSample {
    const base = this.forced ? this.forcedState() : this.baseState(now);
    let ballR: number = R.ballOrbitR;
    let ballY: number = R.ballSpinY;
    let bounceRoll = 0;

    if (base.phase === "spin") {
      // Tiny non-angular life on the outer track; no pocket-relative correction is hidden here.
      ballR += Math.sin(now * 0.02) * 0.012;
      ballY += Math.sin(now * 0.013 + 1) * 0.008;
    } else if (base.phase === "land" || base.phase === "sync" || base.phase === "final_brake" || base.phase === "full_stop") {
      const captureDur = Math.max(1, this.captureEnd - this.landStart);
      const p = this.forced || base.phase !== "land" ? 1 : clamp01((now - this.landStart) / captureDur);
      ballR = landRadius(p, this.lp.path);
      ballY = landHeight(p, this.lp.path);
      // staged endgame: deflector knock + collapsing pocket bounces (spec §17). Decays to 0 by p=1.
      const b = landBounce(p, this.lp);
      ballR += b.dR;
      ballY += b.dY;
      bounceRoll = b.roll;
    }

    const ballDeg = base.rotorDeg + base.relativeDeg;
    const ballVelocityDegPerSec = base.rotorVelocityDegPerSec + base.relativeVelocityDegPerSec;
    this.rotorDeg = base.rotorDeg;
    this.relativeDeg = base.relativeDeg;

    const out = this._out;
    out.rotorDeg = base.rotorDeg;
    out.ballDeg = ballDeg;
    out.relativeDeg = base.relativeDeg;
    out.ballR = ballR;
    out.ballY = ballY;
    // rolling along the track + a short attitude jitter on each pocket bounce (0 at settle)
    out.ballRoll = -((ballDeg * Math.PI) / 180) * (ballR / R.ballR) + bounceRoll;
    out.rotorVelocityDegPerSec = base.rotorVelocityDegPerSec;
    out.ballVelocityDegPerSec = ballVelocityDegPerSec;
    out.relativeVelocityDegPerSec = base.relativeVelocityDegPerSec;
    out.phase = base.phase;
    out.pocketStage = base.pocketStage;
    out.variantId = this.activeVariant?.id ?? null;
    out.impactStrength = this.lp.impactStrength;
    out.rollDirection = this.lp.rollDirection;
    out.spinSequence = this.spinSeq;
    out.motionBagIndex = this.activeBagIndex;
    out.motionBagSlot = this.activeBagSlot;
    out.landed = base.landed;
    return out;
  }

  private forcedState(): BaseState {
    return {
      rotorDeg: this.finalRotorDeg,
      relativeDeg: this.finalRelativeDeg,
      rotorVelocityDegPerSec: 0,
      relativeVelocityDegPerSec: 0,
      phase: "full_stop",
      pocketStage: null,
      landed: true,
    };
  }

  private sampleRelative(now: number): { relativeDeg: number; relativeVelocityDegPerSec: number; pocketStage: PocketAngularStage | null } {
    if (this.relativeStages.length === 0) {
      return {
        relativeDeg: sampleSeg(this.relative, now),
        relativeVelocityDegPerSec: sampleSegVelocity(this.relative, now),
        pocketStage: this.phase === "land" ? "deflector_exit" : null,
      };
    }
    for (const stage of this.relativeStages) {
      if (now < stage.seg.start + stage.seg.dur) {
        return {
          relativeDeg: sampleSeg(stage.seg, now),
          relativeVelocityDegPerSec: sampleSegVelocity(stage.seg, now),
          pocketStage: stage.kind,
        };
      }
    }
    return { relativeDeg: this.finalRelativeDeg, relativeVelocityDegPerSec: 0, pocketStage: "pocket_settle" };
  }

  private baseState(now: number): BaseState {
    if (this.phase === "idle") {
      return {
        rotorDeg: this.rotorDeg,
        relativeDeg: this.relativeDeg,
        rotorVelocityDegPerSec: 0,
        relativeVelocityDegPerSec: 0,
        phase: "idle",
        pocketStage: null,
        landed: false,
      };
    }

    if (this.phase === "land" && now >= this.landEnd) {
      return {
        rotorDeg: this.finalRotorDeg,
        relativeDeg: this.finalRelativeDeg,
        rotorVelocityDegPerSec: 0,
        relativeVelocityDegPerSec: 0,
        phase: "full_stop",
        pocketStage: null,
        landed: true,
      };
    }

    if (this.phase === "land" && now >= this.syncEnd) {
      return {
        rotorDeg: sampleSeg(this.brake, now),
        relativeDeg: this.finalRelativeDeg,
        rotorVelocityDegPerSec: sampleSegVelocity(this.brake, now),
        relativeVelocityDegPerSec: 0,
        phase: "final_brake",
        pocketStage: null,
        landed: false,
      };
    }

    if (this.phase === "land" && now >= this.captureEnd) {
      const dt = (now - this.captureEnd) / 1000;
      return {
        rotorDeg: this.rotor.target + this.syncVelocityDegPerSec * dt,
        relativeDeg: this.finalRelativeDeg,
        rotorVelocityDegPerSec: this.syncVelocityDegPerSec,
        relativeVelocityDegPerSec: 0,
        phase: "sync",
        pocketStage: null,
        landed: false,
      };
    }

    const phase = this.phase;
    const relative = this.sampleRelative(now);
    return {
      rotorDeg: sampleSeg(this.rotor, now),
      relativeDeg: relative.relativeDeg,
      rotorVelocityDegPerSec: sampleSegVelocity(this.rotor, now),
      relativeVelocityDegPerSec: relative.relativeVelocityDegPerSec,
      phase,
      pocketStage: relative.pocketStage,
      landed: phase === "land" && now >= this.landEnd,
    };
  }

  private _out: WheelSample = {
    rotorDeg: 0,
    ballDeg: 0,
    relativeDeg: 0,
    ballR: 0,
    ballY: 0,
    ballRoll: 0,
    rotorVelocityDegPerSec: 0,
    ballVelocityDegPerSec: 0,
    relativeVelocityDegPerSec: 0,
    phase: "idle",
    pocketStage: null,
    variantId: null,
    impactStrength: 1,
    rollDirection: 1,
    spinSequence: 0,
    motionBagIndex: null,
    motionBagSlot: null,
    landed: false,
  };
}
