import { describe, expect, it } from "vitest";
import {
  WheelAnimator,
  WHEEL_MOTION_PROFILES,
  BOUNCE_STAGE_CENTERS,
  BOUNCE_STAGE_GAINS,
  pocketBounceOverlay,
  type WheelSample,
} from "./wheel3dAnimation";
import { R } from "./wheel3dGeometry";
import { FULL_DRAMA_DURATIONS, STANDARD_DURATIONS } from "./motion";
import type { RouletteAnimationMode } from "./animationMode";

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
const NOMINAL = {
  standard: { spinMs: STANDARD_DURATIONS.SPIN_START, landMs: STANDARD_DURATIONS.BALL_LAND },
  full: { spinMs: FULL_DRAMA_DURATIONS.SPIN_START, landMs: FULL_DRAMA_DURATIONS.BALL_LAND },
} as const;

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

describe("WheelAnimator — independent oracle", () => {
  it("EUROPEAN_WHEEL is a clean permutation of 0..36 (oracle sanity)", () => {
    expect(EUROPEAN_WHEEL.length).toBe(37);
    expect(new Set(EUROPEAN_WHEEL).size).toBe(37);
    expect([...EUROPEAN_WHEEL].sort((a, b) => a - b)).toEqual(ALL_NUMBERS);
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

  it("makes full mode's trackable boundary speed clearly slower than standard", () => {
    const standard = driveNominal("standard", 17).spinEnd;
    const full = driveNominal("full", 17).spinEnd;
    expect(absRps(full.relativeVelocityDegPerSec)).toBeLessThanOrEqual(absRps(standard.relativeVelocityDegPerSec) * 0.75);
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
      const profile = WHEEL_MOTION_PROFILES[mode].spin;
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
      const syncSpeed = WHEEL_MOTION_PROFILES[mode].land.syncRps * 360;
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

  it("crosses many pockets during BALL_LAND, so multi-pocket travel needs no extra angle offset", () => {
    // relativeDeg sweeps well over a dozen pockets across the land, then decelerates onto the result pocket.
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
