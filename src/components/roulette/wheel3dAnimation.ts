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
import { R, angleOf } from "./wheel3dGeometry";
import type { RouletteAnimationMode } from "./animationMode";

export type WheelMotionPhase = "idle" | "spin" | "land" | "sync" | "final_brake" | "full_stop";

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

export const WHEEL_MOTION_PROFILES: Readonly<Record<RouletteAnimationMode, MotionProfile>> = {
  // Keeps the whole spin brisk, but the ball is already trackable by the SPIN_START -> BALL_LAND handoff.
  standard: {
    spin: { rotorTurns: 2.0, ballTurns: -3.4, rotorEndRps: 0.9, ballEndRps: -1.2 },
    land: { desiredRelativeTurns: 2.4, rotorTurns: 3.0, syncRps: 0.42, syncHoldMs: 180, finalBrakeMs: 450 },
    scatterScale: 1,
  },
  // Longer and calmer: the trackable boundary relative speed is exactly two thirds of standard.
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

function chooseRelativeTarget(
  currentLocal: number,
  targetMod: number,
  desiredTurns: number,
  startVelocityDegPerSec: number,
  durMs: number,
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
    const delta = currentLocal - target;
    if (delta <= 1e-6) continue; // target must be ahead in the current negative relative direction
    const turns = delta / DEG;
    const score = Math.abs(turns - desiredTurns);
    if (score < fallbackScore) {
      fallback = target;
      fallbackScore = score;
    }

    const seg = makeSeg(currentLocal, target, 0, durMs, startVelocityDegPerSec, 0);
    let monotone = true;
    let bounded = true;
    for (let i = 0; i <= 72; i += 1) {
      const v = sampleSegVelocity(seg, (durMs * i) / 72);
      if (v > 1e-6) monotone = false;
      if (Math.abs(v) > maxAllowed) bounded = false;
    }
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

interface LandParams {
  radialAmp: number;
  radialPhase: number;
  hopAmp: number;
}

interface BaseState {
  rotorDeg: number;
  relativeDeg: number;
  rotorVelocityDegPerSec: number;
  relativeVelocityDegPerSec: number;
  phase: WheelMotionPhase;
  landed: boolean;
}

// ── endgame choreography (spec §17): the gross inward path (radius/height) + the staged pocket bounces.
// These are COSMETIC: they shape ballR/ballY/ballRoll only — never the angle, relative velocity, profiles
// or the result pocket. Everything is a pure function of the land progress p (FPS-independent) and decays
// to exactly 0 by p=1, so the ball settles flush at R.ballRestR / R.ballRestY regardless of seed.

/** Staged pocket-bounce centers (fraction of BALL_LAND). */
export const BOUNCE_STAGE_CENTERS = [0.5, 0.66, 0.79, 0.89] as const;
/** Rapidly-decaying bounce gains. Encodes spec §17.4: stage2<=50%, stage3<=25%, stage4<=10% of stage1.
 *  No even decay, no rubber-ball repetition — the bounce range collapses 3-4 -> 1-2 -> adjacent -> in-pocket. */
export const BOUNCE_STAGE_GAINS = [1, 0.45, 0.22, 0.08] as const;
const BOUNCE_WIDTH = 0.05;
const DEFLECTOR_CENTER = 0.45;
const DEFLECTOR_WIDTH = 0.06;
/** Gaussian pulse — a localized, smooth bump centered at c with half-width w. */
const lobe = (p: number, c: number, w: number) => {
  const x = (p - c) / w;
  return Math.exp(-(x * x));
};

/** Gross radius path: hang near the outer track -> fall inward across the apron -> into the pocket -> flush. */
function landRadius(p: number): number {
  if (p < 0.2) return mix(R.ballOrbitR, R.ballOrbitR - 0.06, smoother(p / 0.2)); // hang: hair of inward creep
  if (p < 0.46) return mix(R.ballOrbitR - 0.06, R.apronInnerR, smoother((p - 0.2) / 0.26)); // inward drop
  if (p < 0.74) return mix(R.apronInnerR, R.ballRestR + 0.18, smoother((p - 0.46) / 0.28)); // into pocket band
  return mix(R.ballRestR + 0.18, R.ballRestR, smoother((p - 0.74) / 0.26)); // settle flush
}

/** Gross height path: ride high (small dip) -> drop to the deflectors -> down to the floor -> rest. */
function landHeight(p: number): number {
  if (p < 0.22) return mix(R.ballSpinY, R.ballSpinY - 0.05, smoother(p / 0.22)); // hang: small dip
  if (p < 0.5) return mix(R.ballSpinY - 0.05, R.deflectorY + 0.06, smoother((p - 0.22) / 0.28)); // fall
  if (p < 0.78) return mix(R.deflectorY + 0.06, R.ballRestY + 0.06, smoother((p - 0.5) / 0.28)); // to floor
  return mix(R.ballRestY + 0.06, R.ballRestY, smoother((p - 0.78) / 0.22)); // settle
}

/** Staged bounce overlay: one outward deflector knock, then the collapsing pocket bounces. dR/dY/roll all
 *  ride the gross path above and are 0 outside (0.3, 0.985) — so the settle is exact at p=1. Seeded only in
 *  amplitude/phase (radius+height rattle), never in the angle. */
function landBounce(p: number, lp: LandParams): { dR: number; dY: number; roll: number } {
  if (p <= 0.3 || p >= 0.985) return { dR: 0, dY: 0, roll: 0 };
  let dR = lp.radialAmp * 1.25 * lobe(p, DEFLECTOR_CENTER, DEFLECTOR_WIDTH); // outward knock off the diamond
  let dY = 0;
  let roll = 0;
  for (let i = 0; i < BOUNCE_STAGE_CENTERS.length; i += 1) {
    const g = BOUNCE_STAGE_GAINS[i]!;
    const s = lobe(p, BOUNCE_STAGE_CENTERS[i]!, BOUNCE_WIDTH);
    dY += lp.hopAmp * g * s; // upward hops, shrinking per stage
    dR += lp.radialAmp * 0.7 * g * s * Math.cos(lp.radialPhase + i * 2.39); // in/out knocks at the frets
    roll += 0.4 * g * s * (i % 2 === 0 ? 1 : -1); // short attitude jitter, decays per stage
  }
  return { dR, dY, roll };
}

/** Test/instrumentation hook: the staged bounce overlay (dR/dY/roll) as a pure function of land progress
 *  p and the seeded amplitudes. Exposed so the §17.4 collapse contract can be asserted directly. */
export function pocketBounceOverlay(p: number, radialAmp: number, hopAmp: number, radialPhase = 0) {
  return landBounce(p, { radialAmp, radialPhase, hopAmp });
}

export class WheelAnimator {
  private rotor: HermiteSeg = makeSeg(0, 0, 0, 1, 0, 0);
  private relative: HermiteSeg = makeSeg(0, 0, 0, 1, 0, 0);
  private brake: HermiteSeg = makeSeg(0, 0, 0, 1, 0, 0);
  private rotorDeg = 0;
  private relativeDeg = 0;
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
  private syncVelocityDegPerSec = 0;
  private lp: LandParams = {
    radialAmp: 0,
    radialPhase: 0,
    hopAmp: 0,
  };

  /** Inject a fixed seed (tests/repro). Cleared by passing null. */
  setSeed(seed: number | null) {
    this.seedOverride = seed;
  }

  /** Force-finalize: the next sample returns the exact p=1 state. */
  forceFinalize() {
    if (this.phase === "land") this.forced = true;
  }

  startSpin(mode: RouletteAnimationMode, spinMs: number, now: number) {
    const cur = this.baseState(now);
    const profile = WHEEL_MOTION_PROFILES[mode].spin;
    this.phase = "spin";
    this.forced = false;
    this.spinSeq += 1;
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
    const profile = WHEEL_MOTION_PROFILES[mode];
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
    const relativeTarget = chooseRelativeTarget(
      cur.relativeDeg,
      angleOf(landedNumber),
      profile.land.desiredRelativeTurns,
      cur.relativeVelocityDegPerSec,
      timing.captureMs,
    );
    this.rotor = makeSeg(cur.rotorDeg, rotorCaptureTarget, now, timing.captureMs, cur.rotorVelocityDegPerSec, this.syncVelocityDegPerSec);
    this.relative = makeSeg(cur.relativeDeg, relativeTarget, now, timing.captureMs, cur.relativeVelocityDegPerSec, 0);
    this.brake = makeSeg(brakeStart, finalRotorTarget, this.syncEnd, Math.max(1, timing.finalBrakeMs), this.syncVelocityDegPerSec, 0);

    const seed = this.seedOverride ?? (this.spinSeq * 2654435761 + landedNumber * 40503 + 0x9e37) >>> 0;
    const rng = mulberry32(seed);
    const scale = profile.scatterScale;
    this.lp = {
      radialAmp: (0.06 + rng() * 0.05) * scale,
      radialPhase: rng() * Math.PI * 2,
      hopAmp: (0.1 + rng() * 0.06) * scale,
    };
  }

  reset() {
    const cur = this.baseState(this.landEnd || 0);
    this.phase = "idle";
    this.forced = false;
    this.syncVelocityDegPerSec = 0;
    this.rotorDeg = cur.rotorDeg;
    this.relativeDeg = cur.relativeDeg;
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
      ballR = landRadius(p);
      ballY = landHeight(p);
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
    out.landed = base.landed;
    return out;
  }

  private forcedState(): BaseState {
    return {
      rotorDeg: this.finalRotorDeg,
      relativeDeg: this.relative.target,
      rotorVelocityDegPerSec: 0,
      relativeVelocityDegPerSec: 0,
      phase: "full_stop",
      landed: true,
    };
  }

  private baseState(now: number): BaseState {
    if (this.phase === "idle") {
      return {
        rotorDeg: this.rotorDeg,
        relativeDeg: this.relativeDeg,
        rotorVelocityDegPerSec: 0,
        relativeVelocityDegPerSec: 0,
        phase: "idle",
        landed: false,
      };
    }

    if (this.phase === "land" && now >= this.landEnd) {
      return {
        rotorDeg: this.finalRotorDeg,
        relativeDeg: this.relative.target,
        rotorVelocityDegPerSec: 0,
        relativeVelocityDegPerSec: 0,
        phase: "full_stop",
        landed: true,
      };
    }

    if (this.phase === "land" && now >= this.syncEnd) {
      return {
        rotorDeg: sampleSeg(this.brake, now),
        relativeDeg: this.relative.target,
        rotorVelocityDegPerSec: sampleSegVelocity(this.brake, now),
        relativeVelocityDegPerSec: 0,
        phase: "final_brake",
        landed: false,
      };
    }

    if (this.phase === "land" && now >= this.captureEnd) {
      const dt = (now - this.captureEnd) / 1000;
      return {
        rotorDeg: this.rotor.target + this.syncVelocityDegPerSec * dt,
        relativeDeg: this.relative.target,
        rotorVelocityDegPerSec: this.syncVelocityDegPerSec,
        relativeVelocityDegPerSec: 0,
        phase: "sync",
        landed: false,
      };
    }

    const phase = this.phase;
    return {
      rotorDeg: sampleSeg(this.rotor, now),
      relativeDeg: sampleSeg(this.relative, now),
      rotorVelocityDegPerSec: sampleSegVelocity(this.rotor, now),
      relativeVelocityDegPerSec: sampleSegVelocity(this.relative, now),
      phase,
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
    landed: false,
  };
}
