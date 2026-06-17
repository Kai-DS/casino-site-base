import { describe, expect, it } from "vitest";
import {
  WheelAnimator,
  WHEEL_MOTION_PROFILES,
  BOUNCE_STAGE_CENTERS,
  BOUNCE_STAGE_GAINS,
  POCKET_HOP_BUDGETS,
  ROULETTE_MOTION_VARIANTS,
  rouletteMotionVariantsForMode,
  rouletteMotionVariantSequence,
  pocketStageWindows,
  pocketBounceOverlay,
  type PocketAngularStage,
  type RouletteMotionVariantId,
  type WheelSample,
} from "./wheel3dAnimation";
import { R } from "./wheel3dGeometry";
import { FULL_DRAMA_DURATIONS, STANDARD_DURATIONS } from "./motion";
import type { RouletteAnimationMode } from "./animationMode";
import { resolveRouletteDebugMotion } from "./rouletteDebugMotion";

// ── INDEPENDENT ORACLE ───────────────────────────────────────────────────────
// The canonical single-zero European wheel sequence, transcribed here independently of the source
// WHEEL_ORDER / angleOf so the test cannot rubber-stamp the same bug.
const EUROPEAN_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31,
  9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;
const SECTOR = 360 / 37;
const expectedAngle = (n: number) => EUROPEAN_WHEEL.indexOf(n as (typeof EUROPEAN_WHEEL)[number]) * SECTOR;

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const angularDist = (a: number, b: number) => {
  const d = Math.abs(norm(a) - norm(b)) % 360;
  return Math.min(d, 360 - d);
};
const allFinite = (s: WheelSample) =>
  [
    s.rotorDeg,
    s.ballDeg,
    s.relativeDeg,
    s.ballR,
    s.ballY,
    s.ballRoll,
    s.rotorVelocityDegPerSec,
    s.ballVelocityDegPerSec,
    s.relativeVelocityDegPerSec,
  ].every((v) => Number.isFinite(v));
const snap = (s: WheelSample): WheelSample => ({ ...s });
const absRps = (degPerSec: number) => Math.abs(degPerSec) / 360;
const rpm = (degPerSec: number) => absRps(degPerSec) * 60;

const MODES: RouletteAnimationMode[] = ["standard", "full", "reduced"];
const REALISM_MODES: Array<"standard" | "full"> = ["standard", "full"];
const ALL_NUMBERS = Array.from({ length: 37 }, (_, n) => n);
const FORCED_RESULTS = [0, 5, 10, 17, 26];
const POCKET_STAGES: Exclude<PocketAngularStage, "deflector_exit">[] = ["pocket_hop_1", "pocket_hop_2", "pocket_hop_3", "pocket_settle"];
const NOMINAL = {
  standard: { spinMs: STANDARD_DURATIONS.SPIN_START, landMs: STANDARD_DURATIONS.BALL_LAND },
  full: { spinMs: FULL_DRAMA_DURATIONS.SPIN_START, landMs: FULL_DRAMA_DURATIONS.BALL_LAND },
} as const;
type StandardVariantId = Extract<RouletteMotionVariantId, "standard_direct" | "standard_high_hop" | "standard_shallow_hit">;
const STANDARD_VARIANTS: readonly StandardVariantId[] = ["standard_direct", "standard_high_hop", "standard_shallow_hit"];

interface StandardMotionMetrics {
  peakBallDegPerSec: number;
  peakRotorDegPerSec: number;
  peakRelativeDegPerSec: number;
  spinEndBallDegPerSec: number;
  landStartRelativeDegPerSec: number;
  prePocketBallTurns: number;
  prePocketRelativeTurns: number;
  fullBallTurns: number;
  fullRelativeTurns: number;
}

const PRE_SLOWDOWN_STANDARD_METRICS: Readonly<Record<StandardVariantId, StandardMotionMetrics>> = {
  standard_direct: {
    peakBallDegPerSec: 943.404989,
    peakRotorDegPerSec: 958.370009,
    peakRelativeDegPerSec: 1493.983374,
    spinEndBallDegPerSec: 432,
    landStartRelativeDegPerSec: 756,
    prePocketBallTurns: 4.826353,
    prePocketRelativeTurns: 6.622158,
    fullBallTurns: 6.344326,
    fullRelativeTurns: 6.78378,
  },
  standard_high_hop: {
    peakBallDegPerSec: 918.159682,
    peakRotorDegPerSec: 674.79883,
    peakRelativeDegPerSec: 1453.313915,
    spinEndBallDegPerSec: 432,
    landStartRelativeDegPerSec: 756,
    prePocketBallTurns: 4.236482,
    prePocketRelativeTurns: 6.622158,
    fullBallTurns: 5.27476,
    fullRelativeTurns: 6.78378,
  },
  standard_shallow_hit: {
    peakBallDegPerSec: 959.220253,
    peakRotorDegPerSec: 970.812879,
    peakRelativeDegPerSec: 1519.35062,
    spinEndBallDegPerSec: 410.4,
    landStartRelativeDegPerSec: 741.6,
    prePocketBallTurns: 4.821144,
    prePocketRelativeTurns: 6.622158,
    fullBallTurns: 6.427855,
    fullRelativeTurns: 6.78378,
  },
};

interface SettleOpts {
  seed?: number | null;
  spinMs?: number;
  landMs?: number;
}

/** Drive spin->land and snapshot the settled sample (at exactly p=1). Copies, since sample() reuses. */
function settle(n: number, mode: RouletteAnimationMode, { seed = null, spinMs = 1000, landMs = 1000 }: SettleOpts = {}): WheelSample {
  const anim = new WheelAnimator();
  if (seed != null) anim.setSeed(seed);
  anim.startSpin(mode, spinMs, 0);
  anim.sample(spinMs);
  anim.startLand(n, mode, landMs, spinMs);
  return snap(anim.sample(spinMs + landMs));
}

function driveNominal(mode: "standard" | "full", n: number, seed = 7) {
  const { spinMs, landMs } = NOMINAL[mode];
  const anim = new WheelAnimator();
  anim.setSeed(seed);
  anim.startSpin(mode, spinMs, 0);
  const spinEnd = snap(anim.sample(spinMs));
  anim.startLand(n, mode, landMs, spinMs);
  const landStart = snap(anim.sample(spinMs));
  const samples: WheelSample[] = [];
  for (let t = 0; t <= spinMs + landMs; t += 8) {
    if (t === spinMs) samples.push(landStart);
    else samples.push(snap(anim.sample(t)));
  }
  const end = snap(anim.sample(spinMs + landMs));
  const postSync = snap(anim.sample(spinMs + landMs + 500));
  return { anim, spinMs, landMs, spinEnd, landStart, samples, end, postSync };
}

function timelineSample(mode: "standard" | "full", n: number, stepMs: number, checkpoints: number[]) {
  const { spinMs, landMs } = NOMINAL[mode];
  const anim = new WheelAnimator();
  anim.setSeed(123);
  anim.startSpin(mode, spinMs, 0);
  const out = new Map<number, WheelSample>();
  let landStarted = false;
  let t = 0;
  for (const target of checkpoints) {
    while (t + stepMs < target) {
      t += stepMs;
      if (!landStarted && t >= spinMs) {
        anim.sample(spinMs);
        anim.startLand(n, mode, landMs, spinMs);
        landStarted = true;
      }
      anim.sample(t);
    }
    if (!landStarted && target >= spinMs) {
      anim.sample(spinMs);
      anim.startLand(n, mode, landMs, spinMs);
      landStarted = true;
    }
    out.set(target, snap(anim.sample(target)));
    t = target;
  }
  return out;
}

function captureInfoFor(mode: "standard" | "full", n = 17, variantId: RouletteMotionVariantId | null = null) {
  const { spinMs, landMs } = NOMINAL[mode];
  const anim = new WheelAnimator();
  anim.setSeed(7);
  anim.setMotionVariantOverride(variantId);
  anim.startSpin(mode, spinMs, 0);
  anim.sample(spinMs);
  anim.startLand(n, mode, landMs, spinMs);
  const activeVariantId = anim.getMotionVariantId();
  for (let dt = 0; dt <= landMs; dt += 1) {
    const s = anim.sample(spinMs + dt);
    if (s.phase === "sync" || s.phase === "final_brake" || s.phase === "full_stop") return { captureMs: dt, variantId: activeVariantId };
  }
  throw new Error(`capture never ended for ${mode}`);
}

function captureMsFor(mode: "standard" | "full", n = 17, variantId: RouletteMotionVariantId | null = null) {
  return captureInfoFor(mode, n, variantId).captureMs;
}

function pocketStageMoves(mode: "standard" | "full", n = 17, variantId: RouletteMotionVariantId | null = null) {
  const { spinMs, landMs } = NOMINAL[mode];
  const info = captureInfoFor(mode, n, variantId);
  const windows = pocketStageWindows(mode, info.captureMs, info.variantId);
  const anim = new WheelAnimator();
  anim.setSeed(7);
  anim.setMotionVariantOverride(variantId);
  anim.startSpin(mode, spinMs, 0);
  anim.sample(spinMs);
  anim.startLand(n, mode, landMs, spinMs);
  return Object.fromEntries(
    windows
      .filter((w) => w.stage !== "deflector_exit")
      .map((w) => {
        const a = snap(anim.sample(spinMs + w.startMs));
        const b = snap(anim.sample(spinMs + w.endMs));
        return [w.stage, Math.abs(b.relativeDeg - a.relativeDeg) / SECTOR];
      }),
  ) as Record<Exclude<PocketAngularStage, "deflector_exit">, number>;
}

function selectedVariant(mode: "standard" | "full", seed: number, overrideId: string | null = null) {
  const anim = new WheelAnimator();
  anim.setSeed(seed);
  anim.setMotionVariantOverride(overrideId);
  anim.startSpin(mode, NOMINAL[mode].spinMs, 0);
  return anim.sample(0).variantId;
}

function standardMotionMetrics(variantId: StandardVariantId): StandardMotionMetrics {
  const { spinMs, landMs } = NOMINAL.standard;
  const anim = new WheelAnimator();
  anim.setSeed(7);
  anim.setMotionVariantOverride(variantId);
  anim.startSpin("standard", spinMs, 0);
  let prev = snap(anim.sample(0));
  let peakBallDegPerSec = 0;
  let peakRotorDegPerSec = 0;
  let peakRelativeDegPerSec = 0;
  let spinEndBallDegPerSec = 0;
  let landStartRelativeDegPerSec = 0;
  let prePocketBallTurns = 0;
  let prePocketRelativeTurns = 0;
  let fullBallTurns = 0;
  let fullRelativeTurns = 0;
  let enteredPocketBand = false;

  for (let t = 1; t <= spinMs + landMs; t += 1) {
    if (t === spinMs) {
      const spinEnd = snap(anim.sample(t));
      spinEndBallDegPerSec = Math.abs(spinEnd.ballVelocityDegPerSec);
      anim.startLand(17, "standard", landMs, spinMs);
      landStartRelativeDegPerSec = Math.abs(anim.sample(t).relativeVelocityDegPerSec);
    }

    const s = snap(anim.sample(t));
    const ballDelta = Math.abs(s.ballDeg - prev.ballDeg) / 360;
    const relativeDelta = Math.abs(s.relativeDeg - prev.relativeDeg) / 360;
    fullBallTurns += ballDelta;
    fullRelativeTurns += relativeDelta;
    if (!enteredPocketBand) {
      prePocketBallTurns += ballDelta;
      prePocketRelativeTurns += relativeDelta;
      if (s.pocketStage === "pocket_hop_1") enteredPocketBand = true;
    }
    peakBallDegPerSec = Math.max(peakBallDegPerSec, Math.abs(s.ballVelocityDegPerSec));
    peakRotorDegPerSec = Math.max(peakRotorDegPerSec, Math.abs(s.rotorVelocityDegPerSec));
    peakRelativeDegPerSec = Math.max(peakRelativeDegPerSec, Math.abs(s.relativeVelocityDegPerSec));
    prev = s;
  }

  return {
    peakBallDegPerSec,
    peakRotorDegPerSec,
    peakRelativeDegPerSec,
    spinEndBallDegPerSec,
    landStartRelativeDegPerSec,
    prePocketBallTurns,
    prePocketRelativeTurns,
    fullBallTurns,
    fullRelativeTurns,
  };
}

function sampleStandardVariantAtStage(variantId: StandardVariantId, stage: PocketAngularStage) {
  const { spinMs, landMs } = NOMINAL.standard;
  const info = captureInfoFor("standard", 17, variantId);
  const window = pocketStageWindows("standard", info.captureMs, variantId).find((w) => w.stage === stage);
  if (!window) throw new Error(`missing ${stage}`);
  const anim = new WheelAnimator();
  anim.setSeed(7);
  anim.setMotionVariantOverride(variantId);
  anim.startSpin("standard", spinMs, 0);
  anim.sample(spinMs);
  anim.startLand(17, "standard", landMs, spinMs);
  return snap(anim.sample(spinMs + window.startMs + window.durationMs * 0.5));
}

function observedPocketStages(variant: (typeof ROULETTE_MOTION_VARIANTS)[number], stepMs = 1) {
  const { spinMs, landMs } = NOMINAL[variant.mode];
  const anim = new WheelAnimator();
  anim.setSeed(7);
  anim.setMotionVariantOverride(variant.id);
  anim.startSpin(variant.mode, spinMs, 0);
  anim.sample(spinMs);
  anim.startLand(17, variant.mode, landMs, spinMs);

  const firstByStage = new Map<PocketAngularStage, WheelSample & { elapsedMs: number; progress: number }>();
  const counts = new Map<PocketAngularStage, number>();
  const transitions: Array<PocketAngularStage | null> = [];
  let previousStage: PocketAngularStage | null | undefined = undefined;
  for (let elapsedMs = 0; elapsedMs <= landMs; elapsedMs += stepMs) {
    const s = snap(anim.sample(spinMs + elapsedMs));
    if (s.pocketStage !== previousStage) {
      transitions.push(s.pocketStage);
      previousStage = s.pocketStage;
    }
    if (s.pocketStage) {
      counts.set(s.pocketStage, (counts.get(s.pocketStage) ?? 0) + 1);
      if (!firstByStage.has(s.pocketStage)) firstByStage.set(s.pocketStage, { ...s, elapsedMs, progress: elapsedMs / landMs });
    }
  }
  return { counts, firstByStage, transitions, end: snap(anim.sample(spinMs + landMs)) };
}

describe("WheelAnimator — independent oracle", () => {
  it("EUROPEAN_WHEEL is a clean permutation of 0..36 (oracle sanity)", () => {
    expect(EUROPEAN_WHEEL.length).toBe(37);
    expect(new Set(EUROPEAN_WHEEL).size).toBe(37);
    expect([...EUROPEAN_WHEEL].sort((a, b) => a - b)).toEqual(ALL_NUMBERS);
  });
});

describe("WheelAnimator motion variants", () => {
  it("defines separate standard/full variant families and non-proportional standard timing", () => {
    const standard = rouletteMotionVariantsForMode("standard");
    const full = rouletteMotionVariantsForMode("full");
    expect(standard.map((v) => v.id)).toEqual(["standard_direct", "standard_high_hop", "standard_shallow_hit"]);
    expect(full.map((v) => v.id)).toEqual(["full_long_track", "full_suspense_hang", "full_high_deflector", "full_low_fast_settle"]);
    expect(NOMINAL.standard.spinMs + NOMINAL.standard.landMs).toBeGreaterThanOrEqual(4200);
    expect(NOMINAL.standard.spinMs + NOMINAL.standard.landMs).toBeLessThanOrEqual(4800);
    expect(NOMINAL.full.spinMs + NOMINAL.full.landMs).toBe(8000);
    const totalRatio = (NOMINAL.standard.spinMs + NOMINAL.standard.landMs) / (NOMINAL.full.spinMs + NOMINAL.full.landMs);
    const hopRatio = standard[0]!.timings.hop1Ms / full[0]!.timings.hop1Ms;
    expect(Math.abs(hopRatio - totalRatio)).toBeGreaterThan(0.25); // standard is not a uniform full-speedup.
  });

  it("selects variants deterministically from seed, stays fixed, and supports debug overrides", () => {
    for (const mode of REALISM_MODES) {
      const variants = rouletteMotionVariantsForMode(mode).map((v) => v.id);
      const seq = rouletteMotionVariantSequence(mode, 42, variants.length * 3);
      expect(seq).toEqual(rouletteMotionVariantSequence(mode, 42, variants.length * 3));
      for (let start = 0; start < seq.length; start += variants.length) {
        expect(new Set(seq.slice(start, start + variants.length))).toEqual(new Set(variants));
      }
      for (let i = variants.length; i < seq.length; i += variants.length) {
        expect(seq[i]).not.toBe(seq[i - 1]);
      }
    }

    expect(selectedVariant("standard", 1, "standard_high_hop")).toBe("standard_high_hop");
    expect(selectedVariant("full", 1, "full_low_fast_settle")).toBe("full_low_fast_settle");
    expect(selectedVariant("standard", 1, "not_a_variant")).toBe("standard_direct");
    expect(selectedVariant("full", 1, "standard_direct")).toBe("full_long_track");

    const anim = new WheelAnimator();
    anim.setSeed(100);
    anim.startSpin("full", NOMINAL.full.spinMs, 0);
    const id = anim.sample(0).variantId;
    anim.sample(NOMINAL.full.spinMs * 0.5);
    anim.sample(NOMINAL.full.spinMs + 120_000); // hidden-tab style jump during the same spin.
    expect(anim.sample(NOMINAL.full.spinMs + 120_000).variantId).toBe(id);
  });

  it("advances spinSeq through the deterministic standard shuffle bag", () => {
    const seed = 77;
    const expected = rouletteMotionVariantSequence("standard", seed, 6);
    const anim = new WheelAnimator();
    anim.setSeed(seed);
    for (let i = 0; i < expected.length; i += 1) {
      anim.startSpin("standard", NOMINAL.standard.spinMs, i * 10_000);
      const s = snap(anim.sample(i * 10_000));
      expect(s.variantId).toBe(expected[i]);
      expect(s.spinSequence).toBe(i + 1);
      expect(s.motionBagIndex).toBe(Math.floor(i / STANDARD_VARIANTS.length));
      expect(s.motionBagSlot).toBe(i % STANDARD_VARIANTS.length);
      expect(s.landed).toBe(false);
    }
  });

  it("makes the three standard variants visibly different in sampled ball path output", () => {
    const direct = sampleStandardVariantAtStage("standard_direct", "pocket_hop_1");
    const highHop = sampleStandardVariantAtStage("standard_high_hop", "pocket_hop_1");
    const shallow = sampleStandardVariantAtStage("standard_shallow_hit", "pocket_hop_1");

    expect(direct.variantId).toBe("standard_direct");
    expect(highHop.variantId).toBe("standard_high_hop");
    expect(shallow.variantId).toBe("standard_shallow_hit");
    expect(direct.phase).toBe("land");
    expect(highHop.pocketStage).toBe("pocket_hop_1");
    expect(shallow.pocketStage).toBe("pocket_hop_1");
    expect(highHop.ballY).toBeGreaterThan(direct.ballY);
    expect(direct.ballY).toBeGreaterThan(shallow.ballY);
    expect(shallow.impactStrength).toBeGreaterThanOrEqual(direct.impactStrength * 1.25);
    expect(shallow.rollDirection).toBe(-1);
    expect(highHop.rollDirection).toBe(1);
    expect(new Set([direct.ballR.toFixed(5), highHop.ballR.toFixed(5), shallow.ballR.toFixed(5)]).size).toBe(3);
    expect(new Set([direct.ballRoll.toFixed(5), highHop.ballRoll.toFixed(5), shallow.ballRoll.toFixed(5)]).size).toBe(3);
  });

  it("observes every pocket hop stage from sample() for every standard/full variant", () => {
    for (const variant of ROULETTE_MOTION_VARIANTS) {
      const observed = observedPocketStages(variant, 1);
      expect(observed.transitions.filter(Boolean)).toEqual(["deflector_exit", ...POCKET_STAGES]);
      for (const stage of POCKET_STAGES) {
        const first = observed.firstByStage.get(stage);
        expect(first).toBeTruthy();
        expect(observed.counts.get(stage)).toBeGreaterThan(0);
        expect(first!.phase).toBe("land");
        expect(first!.pocketStage).toBe(stage);
        expect(allFinite(first!)).toBe(true);
        expect(Number.isFinite(first!.elapsedMs)).toBe(true);
        expect(first!.progress).toBeGreaterThanOrEqual(0);
        expect(first!.progress).toBeLessThan(1);
        expect(first!.impactStrength).toBeCloseTo(variant.visual.radialKnockScale * variant.visual.hopScale, 9);
        expect(first!.rollDirection).toBe(variant.visual.rollDirection);
      }
      const stageSamples = POCKET_STAGES.map((stage) => observed.firstByStage.get(stage)!);
      expect(new Set(stageSamples.map((s) => s.ballR.toFixed(4))).size).toBeGreaterThan(1);
      expect(new Set(stageSamples.map((s) => s.ballY.toFixed(4))).size).toBeGreaterThan(1);
      expect(new Set(stageSamples.map((s) => s.ballRoll.toFixed(4))).size).toBeGreaterThan(1);
      expect(observed.end.phase).toBe("full_stop");
      expect(observed.end.pocketStage).toBeNull();
      expect(observed.end.rotorVelocityDegPerSec).toBeCloseTo(0, 9);
      expect(observed.end.ballVelocityDegPerSec).toBeCloseTo(0, 9);
      expect(observed.end.relativeVelocityDegPerSec).toBeCloseTo(0, 9);
    }
  });

  it("cuts standard velocity and pre-pocket travel to roughly half of the previous standard implementation", () => {
    for (const variantId of STANDARD_VARIANTS) {
      const old = PRE_SLOWDOWN_STANDARD_METRICS[variantId];
      const now = standardMotionMetrics(variantId);
      for (const key of [
        "peakBallDegPerSec",
        "peakRelativeDegPerSec",
        "landStartRelativeDegPerSec",
        "prePocketBallTurns",
        "prePocketRelativeTurns",
      ] as const) {
        expect(now[key]).toBeGreaterThanOrEqual(old[key] * 0.45);
        expect(now[key]).toBeLessThanOrEqual(old[key] * 0.55);
      }
      expect(now.peakRotorDegPerSec).toBeGreaterThanOrEqual(old.peakRotorDegPerSec * 0.5);
      expect(now.peakRotorDegPerSec).toBeLessThanOrEqual(old.peakRotorDegPerSec * 0.6);
      expect(now.fullRelativeTurns).toBeLessThan(old.fullRelativeTurns * 0.56);
      expect(now.fullBallTurns).toBeLessThan(old.fullBallTurns * 0.58);
    }
  });

  it("keeps all variants within safe timing bands", () => {
    const standardMaxHop = Math.max(...rouletteMotionVariantsForMode("standard").map((v) => v.timings.hop1Ms));
    for (const variant of ROULETTE_MOTION_VARIANTS) {
      const mode = variant.mode;
      const captureMs = captureMsFor(mode, 17, variant.id);
      const windows = pocketStageWindows(mode, captureMs, variant.id);
      const hopWindows = windows.slice(1);
      const prePocket = windows[0]!.durationMs;
      expect(hopWindows[0]!.durationMs).toBeGreaterThanOrEqual(mode === "standard" ? 240 : 280);
      expect(hopWindows[1]!.durationMs).toBeGreaterThanOrEqual(mode === "standard" ? 180 : 210);
      expect(hopWindows[2]!.durationMs).toBeGreaterThanOrEqual(mode === "standard" ? 140 : 150);
      expect(hopWindows[3]!.durationMs).toBeGreaterThanOrEqual(mode === "standard" ? 230 : 260);
      expect(prePocket).toBeGreaterThan(900);
      expect(variant.timings.hangMs).toBeGreaterThan(mode === "standard" ? 290 : 900);
      expect(variant.timings.inwardDropMs).toBeGreaterThanOrEqual(mode === "standard" ? 420 : 900);
      if (mode === "full") {
        expect(variant.timings.trackableOrbitMs).toBeGreaterThan(1300);
        expect(variant.timings.hop1Ms).toBeLessThan(standardMaxHop * 2);
        expect(prePocket).toBeGreaterThan(variant.timings.deflectorApproachMs);
      }
    }
  });

  it("settles every pocket correctly for every standard/full variant", () => {
    for (const variant of ROULETTE_MOTION_VARIANTS) {
      const { spinMs, landMs } = NOMINAL[variant.mode];
      for (const n of ALL_NUMBERS) {
        const anim = new WheelAnimator();
        anim.setSeed(17);
        anim.setMotionVariantOverride(variant.id);
        anim.startSpin(variant.mode, spinMs, 0);
        anim.sample(spinMs);
        anim.startLand(n, variant.mode, landMs, spinMs);
        const end = snap(anim.sample(spinMs + landMs));
        const later = snap(anim.sample(spinMs + landMs + 10_000));
        expect(end.variantId).toBe(variant.id);
        expect(angularDist(end.relativeDeg, expectedAngle(n))).toBeLessThan(1e-6);
        expect(end.phase).toBe("full_stop");
        expect(end.rotorVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(end.ballVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(end.relativeVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(later.rotorDeg).toBeCloseTo(end.rotorDeg, 9);
        expect(later.ballDeg).toBeCloseTo(end.ballDeg, 9);
        expect(later.relativeDeg).toBeCloseTo(end.relativeDeg, 9);
      }
    }
  });

  it("forceFinalize() keeps the exact final stop for every variant", () => {
    for (const variant of ROULETTE_MOTION_VARIANTS) {
      const { spinMs, landMs } = NOMINAL[variant.mode];
      const anim = new WheelAnimator();
      anim.setSeed(22);
      anim.setMotionVariantOverride(variant.id);
      anim.startSpin(variant.mode, spinMs, 0);
      anim.sample(spinMs);
      anim.startLand(26, variant.mode, landMs, spinMs);
      anim.forceFinalize();
      const forced = snap(anim.sample(spinMs + 250));
      expect(forced.variantId).toBe(variant.id);
      expect(forced.phase).toBe("full_stop");
      expect(angularDist(forced.relativeDeg, expectedAngle(26))).toBeLessThan(1e-6);
      expect(forced.rotorVelocityDegPerSec).toBeCloseTo(0, 9);
      expect(forced.ballVelocityDegPerSec).toBeCloseTo(0, 9);
      expect(forced.relativeVelocityDegPerSec).toBeCloseTo(0, 9);
    }
  });
});

describe("roulette debug motion query resolution", () => {
  it("keeps normal no-query mode and shuffle-bag behavior untouched", () => {
    expect(resolveRouletteDebugMotion("standard", {})).toEqual({ mode: "standard", variantOverride: null });
    expect(resolveRouletteDebugMotion("full", {})).toEqual({ mode: "full", variantOverride: null });
  });

  it("infers full mode from full variant URLs", () => {
    for (const variantId of ["full_long_track", "full_suspense_hang", "full_high_deflector", "full_low_fast_settle"] as const) {
      expect(resolveRouletteDebugMotion("standard", { rouletteVariant: variantId })).toEqual({
        mode: "full",
        variantOverride: variantId,
      });
    }
  });

  it("infers standard mode from standard variant URLs", () => {
    expect(resolveRouletteDebugMotion("full", { rouletteVariant: "standard_high_hop" })).toEqual({
      mode: "standard",
      variantOverride: "standard_high_hop",
    });
  });

  it("honors explicit mode, and falls back to that mode's default on mismatch or invalid variant", () => {
    expect(resolveRouletteDebugMotion("standard", { rouletteMode: "full", rouletteVariant: "full_long_track" })).toEqual({
      mode: "full",
      variantOverride: "full_long_track",
    });
    expect(resolveRouletteDebugMotion("standard", { rouletteMode: "standard", rouletteVariant: "full_long_track" })).toEqual({
      mode: "standard",
      variantOverride: "standard_direct",
    });
    expect(resolveRouletteDebugMotion("full", { rouletteMode: "full", rouletteVariant: "standard_shallow_hit" })).toEqual({
      mode: "full",
      variantOverride: "full_long_track",
    });
    expect(resolveRouletteDebugMotion("full", { rouletteMode: "full" })).toEqual({
      mode: "full",
      variantOverride: null,
    });
    expect(resolveRouletteDebugMotion("full", { rouletteVariant: "not_a_variant" })).toEqual({
      mode: "full",
      variantOverride: "full_long_track",
    });
    expect(resolveRouletteDebugMotion("standard", { rouletteMode: "reduced", rouletteVariant: "full_low_fast_settle" })).toEqual({
      mode: "reduced",
      variantOverride: null,
    });
  });
});

describe("WheelAnimator landing (§13 — derived from result.number, never the reverse)", () => {
  const DURATIONS = [200, 2200, 5000]; // short / normal / long landMs

  it("settles exactly on the right pocket for ALL 37 numbers x all modes x short/normal/long landMs", () => {
    for (const mode of MODES) {
      for (const n of ALL_NUMBERS) {
        for (const landMs of DURATIONS) {
          const s = settle(n, mode, { landMs, spinMs: 1500 });
          expect(allFinite(s)).toBe(true);
          expect(angularDist(s.ballDeg, expectedAngle(n))).toBeLessThan(1e-6);
          expect(angularDist(s.relativeDeg, expectedAngle(n))).toBeLessThan(1e-6);
          expect(angularDist(s.rotorDeg, 0)).toBeLessThan(1e-6);
          expect(s.ballR).toBeCloseTo(R.ballRestR, 5);
          expect(s.ballY).toBeCloseTo(R.ballRestY, 5);
          expect(s.landed).toBe(true);
        }
      }
    }
  });

  it("is seed-independent at the destination — variation changes the path, not the pocket", () => {
    const seeds = [1, 42, 987654321, 2147483647, 7];
    for (const n of FORCED_RESULTS) {
      for (const seed of seeds) {
        const s = settle(n, "full", { seed });
        expect(angularDist(s.ballDeg, expectedAngle(n))).toBeLessThan(1e-6);
        expect(angularDist(s.relativeDeg, expectedAngle(n))).toBeLessThan(1e-6);
      }
    }
  });

  it("seeded variation lives in the radius/height rattle, NOT the target angle", () => {
    const radii = new Set<string>();
    const angles = new Set<string>();
    for (const seed of [1, 42, 987654321, 2147483647]) {
      const anim = new WheelAnimator();
      anim.setSeed(seed);
      anim.setMotionVariantOverride("full_long_track");
      anim.startSpin("full", 1000, 0);
      anim.sample(1000);
      anim.startLand(8, "full", 2000, 1000);
      const s = anim.sample(2000); // ~p=0.5
      radii.add(s.ballR.toFixed(4));
      angles.add(s.relativeDeg.toFixed(6));
    }
    expect(radii.size).toBeGreaterThan(1);
    expect(angles.size).toBe(1);
  });

  it("moves rotor-local relative angle one direction until capture — no pass-then-pull-back", () => {
    for (const mode of MODES) {
      for (const n of [0, 5, 10, 17, 26, 32, 36, 13]) {
        for (const [spinMs, landMs] of [[1500, 2000], [800, 200], [3000, 5000]] as const) {
          const anim = new WheelAnimator();
          anim.setSeed(4242);
          anim.startSpin(mode, spinMs, 0);
          const seq: number[] = [];
          for (let t = 0; t <= spinMs; t += 8) seq.push(anim.sample(t).relativeDeg);
          anim.startLand(n, mode, landMs, spinMs);
          for (let t = spinMs; t <= spinMs + landMs; t += 8) seq.push(anim.sample(t).relativeDeg);
          for (let i = 1; i < seq.length; i++) {
            expect(seq[i]! - seq[i - 1]!).toBeLessThanOrEqual(1e-6);
          }
          expect(angularDist(anim.sample(spinMs + landMs).relativeDeg, expectedAngle(n))).toBeLessThan(1e-6);
        }
      }
    }
  });

  it("produces only finite samples across the whole spin->land for every mode (no NaN/Infinity)", () => {
    for (const mode of MODES) {
      const anim = new WheelAnimator();
      anim.setSeed(123);
      anim.startSpin(mode, 1500, 0);
      for (let t = 0; t <= 1500; t += 25) expect(allFinite(anim.sample(t))).toBe(true);
      anim.startLand(13, mode, 2000, 1500);
      for (let t = 1500; t <= 3500; t += 25) expect(allFinite(anim.sample(t))).toBe(true);
    }
  });

  it("has no major angular discontinuity through the spin->land handoff or the rattle", () => {
    const anim = new WheelAnimator();
    anim.setSeed(7);
    const spinMs = 1500;
    const landMs = 2000;
    anim.startSpin("standard", spinMs, 0);
    let landed = false;
    let prev = anim.sample(0).relativeDeg;
    const CAP = 90; // far above legit per-step travel, far below a 360deg teleport
    for (let t = 5; t <= spinMs + landMs; t += 5) {
      if (!landed && t >= spinMs) {
        anim.startLand(8, "standard", landMs, spinMs);
        landed = true;
      }
      const cur = anim.sample(t).relativeDeg;
      expect(angularDist(cur, prev)).toBeLessThan(CAP);
      prev = cur;
    }
  });

  it("forceFinalize() clamps the landing to its exact final state immediately (p=1)", () => {
    for (const n of [0, 17, 26]) {
      const anim = new WheelAnimator();
      anim.setSeed(3);
      anim.startSpin("full", 1000, 0);
      anim.sample(1000);
      anim.startLand(n, "full", 4000, 1000);
      expect(anim.sample(1400).landed).toBe(false);
      anim.forceFinalize();
      const s = anim.sample(1400);
      expect(s.landed).toBe(true);
      expect(angularDist(s.ballDeg, expectedAngle(n))).toBeLessThan(1e-6);
      expect(angularDist(s.relativeDeg, expectedAngle(n))).toBeLessThan(1e-6);
      expect(angularDist(s.rotorDeg, 0)).toBeLessThan(1e-6);
      expect(s.ballR).toBeCloseTo(R.ballRestR, 5);
      expect(s.ballY).toBeCloseTo(R.ballRestY, 5);
    }
  });

  it("does not let a previous spin bleed into the next (same instance, reset + re-spin)", () => {
    const anim = new WheelAnimator();
    anim.setSeed(5);
    anim.startSpin("full", 1000, 0);
    anim.sample(1000);
    anim.startLand(32, "full", 1000, 1000);
    expect(angularDist(anim.sample(2000).relativeDeg, expectedAngle(32))).toBeLessThan(1e-6);
    anim.startSpin("full", 1000, 2000);
    anim.sample(3000);
    anim.startLand(5, "full", 1000, 3000);
    const end2 = snap(anim.sample(4000));
    expect(angularDist(end2.relativeDeg, expectedAngle(5))).toBeLessThan(1e-6);
    expect(angularDist(end2.rotorDeg, 0)).toBeLessThan(1e-6);
    anim.reset();
    anim.startSpin("standard", 800, 4000);
    anim.sample(4800);
    anim.startLand(0, "standard", 800, 4800);
    expect(angularDist(anim.sample(5600).relativeDeg, expectedAngle(0))).toBeLessThan(1e-6);
  });
});

describe("WheelAnimator realism velocity contract", () => {
  it("keeps SPIN_START -> BALL_LAND C1-continuous and eliminates the old land-start speed spike", () => {
    for (const mode of REALISM_MODES) {
      for (const n of FORCED_RESULTS) {
        const { spinEnd, landStart } = driveNominal(mode, n);
        expect(landStart.rotorVelocityDegPerSec).toBeCloseTo(spinEnd.rotorVelocityDegPerSec, 9);
        expect(landStart.relativeVelocityDegPerSec).toBeCloseTo(spinEnd.relativeVelocityDegPerSec, 9);
        expect(landStart.ballVelocityDegPerSec).toBeCloseTo(spinEnd.ballVelocityDegPerSec, 9);
        expect(rpm(landStart.relativeVelocityDegPerSec)).toBeLessThan(300);
      }
    }
  });

  it("caps relative speed well below the previous 500-1000rpm behavior", () => {
    const maxRpm: Record<"standard" | "full", number> = { standard: 300, full: 250 };
    for (const mode of REALISM_MODES) {
      for (const n of FORCED_RESULTS) {
        const { samples } = driveNominal(mode, n);
        const peak = Math.max(...samples.map((s) => rpm(s.relativeVelocityDegPerSec)));
        expect(peak).toBeLessThan(maxRpm[mode]);
      }
    }
  });

  it("does not accelerate relative motion after BALL_LAND starts", () => {
    for (const mode of REALISM_MODES) {
      for (const n of FORCED_RESULTS) {
        const { landStart, samples, spinMs } = driveNominal(mode, n);
        const landSamples = samples.filter((_, i) => i * 8 >= spinMs);
        const peakAfterLand = Math.max(...landSamples.map((s) => absRps(s.relativeVelocityDegPerSec)));
        expect(peakAfterLand).toBeLessThanOrEqual(absRps(landStart.relativeVelocityDegPerSec) * 1.05 + 1e-6);
      }
    }
  });

  it("keeps standard's trackable boundary slower than full instead of compressing the full profile", () => {
    const standard = driveNominal("standard", 17).spinEnd;
    const full = driveNominal("full", 17).spinEnd;
    expect(absRps(standard.relativeVelocityDegPerSec)).toBeLessThan(absRps(full.relativeVelocityDegPerSec));
    expect(absRps(standard.ballVelocityDegPerSec)).toBeLessThan(absRps(full.ballVelocityDegPerSec));
    expect(rouletteMotionVariantsForMode("standard")[0]!.spin).not.toEqual(rouletteMotionVariantsForMode("full")[0]!.spin);
    expect(rouletteMotionVariantsForMode("standard")[0]!.timings).not.toEqual(rouletteMotionVariantsForMode("full")[0]!.timings);
  });

  it("ends at a full world-space stop after rotor sync and final braking", () => {
    for (const mode of REALISM_MODES) {
      for (const n of FORCED_RESULTS) {
        const { end, postSync } = driveNominal(mode, n);
        expect(end.landed).toBe(true);
        expect(end.phase).toBe("full_stop");
        expect(end.relativeVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(end.ballVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(end.rotorVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(angularDist(end.relativeDeg, expectedAngle(n))).toBeLessThan(1e-6);

        expect(postSync.phase).toBe("full_stop");
        expect(postSync.relativeVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(postSync.ballVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(postSync.rotorVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(postSync.relativeDeg).toBeCloseTo(end.relativeDeg, 9);
        expect(postSync.rotorDeg).toBeCloseTo(end.rotorDeg, 9);
        expect(postSync.ballDeg).toBeCloseTo(end.ballDeg, 9);
      }
    }
  });

  it("uses signed velocities: rotor and ball are opposite during orbit, then same after capture", () => {
    for (const mode of REALISM_MODES) {
      const { spinEnd, end } = driveNominal(mode, 17);
      expect(spinEnd.rotorVelocityDegPerSec).toBeGreaterThan(0);
      expect(spinEnd.ballVelocityDegPerSec).toBeLessThan(0);
      expect(end.rotorVelocityDegPerSec).toBeCloseTo(0, 9);
      expect(end.ballVelocityDegPerSec).toBeCloseTo(0, 9);
    }
  });

  it("honors the committed profile values for the trackable spin boundary", () => {
    for (const mode of REALISM_MODES) {
      const { spinEnd } = driveNominal(mode, 17);
      const variant = ROULETTE_MOTION_VARIANTS.find((v) => v.id === spinEnd.variantId);
      const profile = variant?.spin ?? WHEEL_MOTION_PROFILES[mode].spin;
      expect(spinEnd.rotorVelocityDegPerSec).toBeCloseTo(profile.rotorEndRps * 360, 9);
      expect(spinEnd.ballVelocityDegPerSec).toBeCloseTo(profile.ballEndRps * 360, 9);
    }
  });

  it("has a real sync-hold phase, then a shared final brake before landed=true", () => {
    for (const mode of REALISM_MODES) {
      const { spinMs, landMs } = NOMINAL[mode];
      const anim = new WheelAnimator();
      anim.setSeed(9);
      anim.startSpin(mode, spinMs, 0);
      anim.sample(spinMs);
      anim.startLand(17, mode, landMs, spinMs);

      const syncSamples: WheelSample[] = [];
      const brakeSamples: WheelSample[] = [];
      for (let t = spinMs; t <= spinMs + landMs; t += 4) {
        const s = snap(anim.sample(t));
        if (s.phase === "sync") syncSamples.push(s);
        if (s.phase === "final_brake") brakeSamples.push(s);
        if (s.phase === "sync" || s.phase === "final_brake") {
          expect(s.relativeVelocityDegPerSec).toBeCloseTo(0, 9);
          expect(s.ballVelocityDegPerSec).toBeCloseTo(s.rotorVelocityDegPerSec, 9);
          expect(angularDist(s.relativeDeg, expectedAngle(17))).toBeLessThan(1e-6);
        }
        if (t < spinMs + landMs) expect(s.landed).toBe(false);
      }

      expect(syncSamples.length).toBeGreaterThan(0);
      expect(brakeSamples.length).toBeGreaterThan(0);
      const activeVariant = ROULETTE_MOTION_VARIANTS.find((v) => v.id === anim.getMotionVariantId());
      const syncSpeed = (activeVariant?.land.syncRps ?? WHEEL_MOTION_PROFILES[mode].land.syncRps) * 360;
      expect(Math.max(...brakeSamples.map((s) => s.rotorVelocityDegPerSec))).toBeLessThanOrEqual(syncSpeed + 1e-6);
      for (let i = 1; i < brakeSamples.length; i += 1) {
        expect(brakeSamples[i]!.rotorVelocityDegPerSec).toBeLessThanOrEqual(brakeSamples[i - 1]!.rotorVelocityDegPerSec + 1e-6);
        expect(brakeSamples[i]!.rotorVelocityDegPerSec).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it("keeps the terminal full-stop state immutable at end+100ms, +1s and +10s", () => {
    for (const mode of REALISM_MODES) {
      for (const n of FORCED_RESULTS) {
        const { spinMs, landMs, anim, end } = driveNominal(mode, n);
        for (const dt of [100, 1000, 10_000]) {
          const later = snap(anim.sample(spinMs + landMs + dt));
          expect(later.landed).toBe(true);
          expect(later.phase).toBe("full_stop");
          expect(later.rotorDeg).toBeCloseTo(end.rotorDeg, 9);
          expect(later.ballDeg).toBeCloseTo(end.ballDeg, 9);
          expect(later.relativeDeg).toBeCloseTo(end.relativeDeg, 9);
          expect(later.ballR).toBeCloseTo(R.ballRestR, 9);
          expect(later.ballY).toBeCloseTo(R.ballRestY, 9);
          expect(later.rotorVelocityDegPerSec).toBeCloseTo(0, 9);
          expect(later.ballVelocityDegPerSec).toBeCloseTo(0, 9);
          expect(later.relativeVelocityDegPerSec).toBeCloseTo(0, 9);
        }
      }
    }
  });

  it("forceFinalize() immediately applies the new full-stop terminal contract and stays stopped", () => {
    for (const mode of REALISM_MODES) {
      const { spinMs, landMs } = NOMINAL[mode];
      const anim = new WheelAnimator();
      anim.setSeed(12);
      anim.startSpin(mode, spinMs, 0);
      anim.sample(spinMs);
      anim.startLand(26, mode, landMs, spinMs);
      anim.forceFinalize();
      const forced = snap(anim.sample(spinMs + landMs * 0.2));
      const later = snap(anim.sample(spinMs + landMs * 0.2 + 5000));
      for (const s of [forced, later]) {
        expect(s.landed).toBe(true);
        expect(s.phase).toBe("full_stop");
        expect(angularDist(s.relativeDeg, expectedAngle(26))).toBeLessThan(1e-6);
        expect(s.ballR).toBeCloseTo(R.ballRestR, 9);
        expect(s.ballY).toBeCloseTo(R.ballRestY, 9);
        expect(s.rotorVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(s.ballVelocityDegPerSec).toBeCloseTo(0, 9);
        expect(s.relativeVelocityDegPerSec).toBeCloseTo(0, 9);
      }
      expect(later.rotorDeg).toBeCloseTo(forced.rotorDeg, 9);
      expect(later.ballDeg).toBeCloseTo(forced.ballDeg, 9);
    }
  });
});

describe("WheelAnimator endgame choreography (spec §17)", () => {
  it("staged bounce gains collapse rapidly: stage2<=50%, stage3<=25%, stage4<=10% of stage1", () => {
    expect(BOUNCE_STAGE_GAINS.length).toBe(4);
    expect(BOUNCE_STAGE_CENTERS.length).toBe(4);
    const [g1, g2, g3, g4] = BOUNCE_STAGE_GAINS;
    expect(g1).toBe(1);
    expect(g2).toBeLessThanOrEqual(0.5 * g1);
    expect(g3).toBeLessThanOrEqual(0.25 * g1);
    expect(g4).toBeLessThanOrEqual(0.1 * g1);
    for (let i = 1; i < BOUNCE_STAGE_GAINS.length; i += 1) {
      expect(BOUNCE_STAGE_GAINS[i]!).toBeLessThan(BOUNCE_STAGE_GAINS[i - 1]!); // strictly shrinking
      expect(BOUNCE_STAGE_CENTERS[i]!).toBeGreaterThan(BOUNCE_STAGE_CENTERS[i - 1]!); // ordered in time
    }
    expect(BOUNCE_STAGE_CENTERS[BOUNCE_STAGE_CENTERS.length - 1]!).toBeLessThan(1); // last bounce before settle
  });

  it("vertical hops shrink stage-to-stage and the overlay is exactly 0 before the drop and at the settle", () => {
    const hopAmp = 0.13;
    const radialAmp = 0.08;
    const lifts = BOUNCE_STAGE_CENTERS.map((c) => pocketBounceOverlay(c, radialAmp, hopAmp, 0).dY);
    expect(lifts[0]!).toBeGreaterThan(0); // there is a real first bounce
    for (let i = 1; i < lifts.length; i += 1) expect(lifts[i]!).toBeLessThan(lifts[i - 1]!);
    expect(lifts[lifts.length - 1]!).toBeLessThanOrEqual(lifts[0]! * 0.2); // last bounce <= 20% of the first
    // no rattle outside the (0.3, 0.985) window → settle at p=1 is exact, nothing before the inward drop
    expect(pocketBounceOverlay(0.2, radialAmp, hopAmp, 0).dY).toBe(0);
    expect(pocketBounceOverlay(0.99, radialAmp, hopAmp, 0).dY).toBe(0);
    expect(pocketBounceOverlay(1, radialAmp, hopAmp, 0).dR).toBe(0);
  });

  it("produces a clear outward deflector knock in the radius (pushed out, then gone)", () => {
    expect(pocketBounceOverlay(0.45, 0.1, 0.1, 0).dR).toBeGreaterThan(0.05); // outward knock off the diamond
    expect(pocketBounceOverlay(1, 0.1, 0.1, 0).dR).toBe(0);
  });

  it("the rendered ball is flush with no residual rattle just before p=1, and exact at p=1", () => {
    for (const mode of REALISM_MODES) {
      const { spinMs, landMs } = NOMINAL[mode];
      const anim = new WheelAnimator();
      anim.setSeed(11);
      anim.startSpin(mode, spinMs, 0);
      anim.sample(spinMs);
      anim.startLand(17, mode, landMs, spinMs);
      const near = snap(anim.sample(spinMs + landMs - 1)); // p ≈ 0.9998 → bounces already gone
      expect(Math.abs(near.ballR - R.ballRestR)).toBeLessThan(0.03);
      expect(Math.abs(near.ballY - R.ballRestY)).toBeLessThan(0.03);
      const end = snap(anim.sample(spinMs + landMs));
      expect(end.ballR).toBeCloseTo(R.ballRestR, 6);
      expect(end.ballY).toBeCloseTo(R.ballRestY, 6);
    }
  });

  it("still spends the early landing on meaningful travel, before the pocket-band hops take over", () => {
    // The big alignment happens before the pocket band; the staged hops below must stay small.
    for (const mode of REALISM_MODES) {
      const { spinMs, landMs } = NOMINAL[mode];
      const anim = new WheelAnimator();
      anim.setSeed(7);
      anim.startSpin(mode, spinMs, 0);
      const startLocal = anim.sample(spinMs).relativeDeg;
      anim.startLand(17, mode, landMs, spinMs);
      const endLocal = anim.sample(spinMs + landMs).relativeDeg;
      const pocketsCrossed = Math.abs(startLocal - endLocal) / SECTOR;
      expect(pocketsCrossed).toBeGreaterThan(12);
    }
  });

  it("limits pocket-band angular travel to 3-4, 1-2, adjacent, then in-pocket movement", () => {
    for (const mode of REALISM_MODES) {
      const moves = pocketStageMoves(mode, 17);
      expect(moves.pocket_hop_1).toBeGreaterThanOrEqual(3.0);
      expect(moves.pocket_hop_1).toBeLessThanOrEqual(4.5);
      expect(moves.pocket_hop_2).toBeGreaterThanOrEqual(1.0);
      expect(moves.pocket_hop_2).toBeLessThanOrEqual(2.0);
      expect(moves.pocket_hop_3).toBeGreaterThanOrEqual(0.5);
      expect(moves.pocket_hop_3).toBeLessThanOrEqual(1.0);
      expect(moves.pocket_settle).toBeGreaterThanOrEqual(0);
      expect(moves.pocket_settle).toBeLessThanOrEqual(0.35);
      expect(moves.pocket_hop_1).toBeLessThan(4.6); // rejects the old 14-16 pocket first hop.
      expect(moves.pocket_hop_2).toBeLessThan(moves.pocket_hop_1);
      expect(moves.pocket_hop_3).toBeLessThan(moves.pocket_hop_2);
      expect(moves.pocket_settle).toBeLessThan(moves.pocket_hop_3);
    }
  });

  it("keeps full mode's pocket-hop distances in the same range as standard", () => {
    const standard = pocketStageMoves("standard", 17);
    const full = pocketStageMoves("full", 17);
    for (const stage of POCKET_STAGES) {
      expect(full[stage]).toBeCloseTo(standard[stage], 6);
    }
    expect(standard.pocket_hop_1).toBeCloseTo(POCKET_HOP_BUDGETS.hop1Pockets, 6);
    expect(standard.pocket_hop_2).toBeCloseTo(POCKET_HOP_BUDGETS.hop2Pockets, 6);
    expect(standard.pocket_hop_3).toBeCloseTo(POCKET_HOP_BUDGETS.hop3Pockets, 6);
    expect(standard.pocket_settle).toBeCloseTo(POCKET_HOP_BUDGETS.settlePockets, 6);
  });

  it("keeps angle and velocity C1-continuous at every pocket-stage boundary", () => {
    for (const mode of REALISM_MODES) {
      const { spinMs, landMs } = NOMINAL[mode];
      const info = captureInfoFor(mode, 17);
      const windows = pocketStageWindows(mode, info.captureMs, info.variantId);
      const anim = new WheelAnimator();
      anim.setSeed(19);
      anim.setMotionVariantOverride(info.variantId);
      anim.startSpin(mode, spinMs, 0);
      anim.sample(spinMs);
      anim.startLand(17, mode, landMs, spinMs);
      const boundaries = [...windows.slice(1).map((w) => spinMs + w.startMs), spinMs + info.captureMs];
      for (const boundary of boundaries) {
        const before = snap(anim.sample(boundary - 0.001));
        const at = snap(anim.sample(boundary));
        const after = snap(anim.sample(boundary + 0.001));
        expect(before.relativeDeg).toBeCloseTo(at.relativeDeg, 3);
        expect(after.relativeDeg).toBeCloseTo(at.relativeDeg, 3);
        expect(before.relativeVelocityDegPerSec).toBeCloseTo(after.relativeVelocityDegPerSec, 2);
        expect(at.relativeVelocityDegPerSec).toBeLessThanOrEqual(1e-6);
      }
    }
  });

  it("aligns radius/height bounce centers to the angular pocket-hop stages", () => {
    for (const mode of REALISM_MODES) {
      const { spinMs, landMs } = NOMINAL[mode];
      const info = captureInfoFor(mode, 17);
      const windows = pocketStageWindows(mode, info.captureMs, info.variantId).slice(1);
      const anim = new WheelAnimator();
      anim.setSeed(23);
      anim.setMotionVariantOverride(info.variantId);
      anim.startSpin(mode, spinMs, 0);
      anim.sample(spinMs);
      anim.startLand(17, mode, landMs, spinMs);
      for (const w of windows) {
        const center = spinMs + w.startMs + w.durationMs * 0.5;
        expect(anim.sample(center).pocketStage).toBe(w.stage);
      }
    }
  });
});

describe("WheelAnimator FPS independence", () => {
  it("returns the same state at the same elapsed times for 30fps, 60fps and 120fps sampling", () => {
    for (const mode of REALISM_MODES) {
      const { spinMs, landMs } = NOMINAL[mode];
      const checkpoints = [spinMs * 0.25, spinMs, spinMs + landMs * 0.35, spinMs + landMs, spinMs + landMs + 500];
      const thirty = timelineSample(mode, 17, 1000 / 30, checkpoints);
      const sixty = timelineSample(mode, 17, 1000 / 60, checkpoints);
      const oneTwenty = timelineSample(mode, 17, 1000 / 120, checkpoints);

      for (const t of checkpoints) {
        const a = thirty.get(t)!;
        for (const b of [sixty.get(t)!, oneTwenty.get(t)!]) {
          expect(b.variantId).toBe(a.variantId);
          expect(b.ballDeg).toBeCloseTo(a.ballDeg, 9);
          expect(b.rotorDeg).toBeCloseTo(a.rotorDeg, 9);
          expect(b.relativeDeg).toBeCloseTo(a.relativeDeg, 9);
          expect(b.ballR).toBeCloseTo(a.ballR, 9);
          expect(b.ballY).toBeCloseTo(a.ballY, 9);
          expect(angularDist(b.relativeDeg, a.relativeDeg)).toBeLessThan(1e-8);
        }
      }
    }
  });
});
