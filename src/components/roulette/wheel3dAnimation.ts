// components/roulette/wheel3dAnimation.ts
// Per-frame rotor/ball angle state machine for the 3D wheel (§10, §13). The rotor only ever turns
// WHOLE turns, so at rest its rotation is identity and pockets sit at angleOf(n); the ball settles to
// angleOf(landedNumber). Landing is therefore derived from result.number — never the reverse (§13.2).
// This computes visuals only; the queue still owns ack/timing.
import { R, SECTOR_DEG, angleOf } from "./wheel3dGeometry";
import type { RouletteAnimationMode } from "./animationMode";

export interface WheelSample {
  rotorDeg: number;
  ballDeg: number;
  ballR: number;
  ballY: number;
}

const SPIN_TURNS: Record<RouletteAnimationMode, number> = { standard: 6, full: 11, reduced: 1 };
const LAND_TURNS: Record<RouletteAnimationMode, number> = { standard: 3, full: 5, reduced: 1 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const linear = (t: number) => t;
/** stays out near the rim, then dives inward in the back half */
const delayedDrop = (t: number) => (t < 0.45 ? 0 : Math.pow((t - 0.45) / 0.55, 1.6));

interface Seg {
  base: number;
  target: number;
  start: number;
  dur: number;
  ease: (t: number) => number;
}
const sampleSeg = (s: Seg, now: number) => s.base + (s.target - s.base) * s.ease(clamp01((now - s.start) / s.dur));
const settleBelow = (ceil: number, targetMod: number) => ceil - (((((ceil - targetMod) % 360) + 360) % 360));

export class WheelAnimator {
  private rotor: Seg = { base: 0, target: 0, start: 0, dur: 1, ease: linear };
  private ball: Seg = { base: 0, target: 0, start: 0, dur: 1, ease: linear };
  private ballR: Seg = { base: R.ballOrbitR, target: R.ballOrbitR, start: 0, dur: 1, ease: linear };
  private ballY: Seg = { base: R.ballSpinY, target: R.ballSpinY, start: 0, dur: 1, ease: linear };
  private rotorDeg = 0;
  private ballDeg = 0;
  private landing = false;
  private landStart = 0;
  private landDur = 1;
  private mode: RouletteAnimationMode = "standard";

  startSpin(mode: RouletteAnimationMode, spinMs: number, now: number) {
    this.mode = mode;
    this.landing = false;
    const turns = SPIN_TURNS[mode];
    const dur = Math.max(80, spinMs);
    this.rotor = { base: this.rotorDeg, target: this.rotorDeg + turns * 360, start: now, dur, ease: linear };
    this.ball = { base: this.ballDeg, target: this.ballDeg - (turns + 2) * 360, start: now, dur, ease: linear };
    this.ballR = { base: R.ballOrbitR, target: R.ballOrbitR, start: now, dur: 1, ease: linear };
    this.ballY = { base: R.ballSpinY, target: R.ballSpinY, start: now, dur: 1, ease: linear };
  }

  startLand(landedNumber: number, mode: RouletteAnimationMode, landMs: number, now: number) {
    this.mode = mode;
    this.landing = true;
    this.landStart = now;
    this.landDur = Math.max(80, landMs);
    const curR = sampleSeg(this.rotor, now);
    const curB = sampleSeg(this.ball, now);
    const turns = LAND_TURNS[mode];
    // rotor finishes on a whole turn (≡ identity) so pockets rest at angleOf(n)
    const rotorTarget = Math.ceil((curR + turns * 360) / 360) * 360;
    // ball settles, still counter-clockwise, to angleOf(landedNumber)
    const ballTarget = settleBelow(curB - turns * 360, angleOf(landedNumber));
    this.rotor = { base: curR, target: rotorTarget, start: now, dur: this.landDur, ease: easeOutQuart };
    this.ball = { base: curB, target: ballTarget, start: now, dur: this.landDur, ease: easeOutQuart };
    this.ballR = { base: R.ballOrbitR, target: R.ballRestR, start: now, dur: this.landDur, ease: delayedDrop };
    this.ballY = { base: R.ballSpinY, target: R.ballRestY, start: now, dur: this.landDur, ease: delayedDrop };
  }

  reset() {
    this.landing = false;
    this.ballR = { base: R.ballOrbitR, target: R.ballOrbitR, start: 0, dur: 1, ease: linear };
    this.ballY = { base: R.ballSpinY, target: R.ballSpinY, start: 0, dur: 1, ease: linear };
  }

  sample(now: number): WheelSample {
    const rotorDeg = sampleSeg(this.rotor, now);
    let ballDeg = sampleSeg(this.ball, now);
    const ballR = sampleSeg(this.ballR, now);
    let ballY = sampleSeg(this.ballY, now);
    if (this.landing) {
      const p = clamp01((now - this.landStart) / this.landDur);
      // FULL: graze 1–2 pockets near the end, damped to exactly 0 at p=1 (always lands on target)
      if (this.mode === "full" && p > 0.5) {
        ballDeg += Math.sin(p * Math.PI * 6.5) * (SECTOR_DEG * 1.6) * Math.pow(1 - p, 2);
      }
      // small settle bounce
      if (p > 0.82) {
        const b = (p - 0.82) / 0.18;
        ballY += Math.sin(b * Math.PI) * 0.07 * (1 - b);
      }
    }
    this.rotorDeg = rotorDeg;
    this.ballDeg = ballDeg;
    return { rotorDeg, ballDeg, ballR, ballY };
  }
}
