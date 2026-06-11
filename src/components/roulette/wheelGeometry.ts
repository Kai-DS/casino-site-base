// components/roulette/wheelGeometry.ts
// Single-source wheel geometry built from WHEEL_ORDER (addendum §1.2 / §9 / §11). The wheel SVG,
// the racetrack and the ball-landing angle all derive their number order from here — no duplicate
// number arrays anywhere in the UI.
import { WHEEL_ORDER, colorOf, type PocketColor } from "@/games/roulette/constants/wheel";

export const POCKET_COUNT = WHEEL_ORDER.length; // 37
export const SECTOR_DEG = 360 / POCKET_COUNT;

/** Angle (deg, 0 = top, clockwise) of pocket `n`'s centre on the wheel (§11.2). */
export function angleOf(n: number): number {
  const i = WHEEL_ORDER.indexOf(n as (typeof WHEEL_ORDER)[number]);
  return i < 0 ? 0 : i * SECTOR_DEG;
}

/** Cartesian point on a circle centred at (cx,cy); deg measured clockwise from the top. */
export function pointOnCircle(cx: number, cy: number, radius: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) };
}

export interface WheelSector {
  n: number;
  color: PocketColor;
  /** Annular-sector path string (outer arc → inner arc) in the given viewBox. */
  path: string;
  /** Number-label centre. */
  label: { x: number; y: number };
  /** Rotation (deg) so the label sits upright-ish along its radius. */
  labelRotation: number;
  midDeg: number;
}

export interface WheelGeometry {
  cx: number;
  cy: number;
  outerR: number;
  ringR: number;
  pocketR: number;
  labelR: number;
  ballR: number;
  hubR: number;
  sectors: WheelSector[];
}

/** Build the wheel geometry for a square viewBox of `size` units (default 100). */
export function buildWheelGeometry(size = 100): WheelGeometry {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.5; // metal rim outer edge
  const ringR = size * 0.43; // rim inner edge = pocket sector outer edge
  const pocketR = size * 0.2; // pocket sector inner edge
  const labelR = size * 0.31; // number label radius
  const ballR = size * 0.385; // ball orbit (just inside the rim)
  const hubR = size * 0.16; // central gold hub

  const sectors = WHEEL_ORDER.map((n, i): WheelSector => {
    const mid = i * SECTOR_DEG;
    const a0 = mid - SECTOR_DEG / 2;
    const a1 = mid + SECTOR_DEG / 2;
    const o0 = pointOnCircle(cx, cy, ringR, a0);
    const o1 = pointOnCircle(cx, cy, ringR, a1);
    const i1 = pointOnCircle(cx, cy, pocketR, a1);
    const i0 = pointOnCircle(cx, cy, pocketR, a0);
    const path = [
      `M ${o0.x.toFixed(2)} ${o0.y.toFixed(2)}`,
      `A ${ringR.toFixed(2)} ${ringR.toFixed(2)} 0 0 1 ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
      `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
      `A ${pocketR.toFixed(2)} ${pocketR.toFixed(2)} 0 0 0 ${i0.x.toFixed(2)} ${i0.y.toFixed(2)}`,
      "Z",
    ].join(" ");
    const label = pointOnCircle(cx, cy, labelR, mid);
    return { n, color: colorOf(n), path, label, labelRotation: mid, midDeg: mid };
  });

  return { cx, cy, outerR, ringR, pocketR, labelR, ballR, hubR, sectors };
}

export const WHEEL_GEOMETRY = buildWheelGeometry(100);
