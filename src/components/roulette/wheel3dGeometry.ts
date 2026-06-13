// components/roulette/wheel3dGeometry.ts
// Procedural geometry constants + helpers for the 3D wheel (Roulette 3D Wheel Upgrade §8). The pocket
// ORDER and the landing angle come ONLY from WHEEL_ORDER / angleOf (single source, §8/§13) — the 3D
// layer never derives the result from an angle.
import * as THREE from "three";
import { WHEEL_ORDER, colorOf, type PocketColor } from "@/games/roulette/constants/wheel";

export const POCKETS = WHEEL_ORDER.length; // 37
export const SECTOR_RAD = (Math.PI * 2) / POCKETS;
export const SECTOR_DEG = 360 / POCKETS;

/** Angle (deg, 0 = far side "top", clockwise) of pocket n — same convention as the SVG wheel (§13.1). */
export function angleOf(n: number): number {
  const i = WHEEL_ORDER.indexOf(n as (typeof WHEEL_ORDER)[number]);
  return i < 0 ? 0 : i * SECTOR_DEG;
}

/** World position on the horizontal wheel for an angle (deg) + radius. angle 0 → -Z (far side). */
export function posAt(angleDeg: number, radius: number, y = 0): [number, number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [radius * Math.sin(a), y, -radius * Math.cos(a)];
}

// ── radii / sizes (world units; wheel ≈ ⌀10) ─────────────────────────────────
export const R = {
  bowlOuter: 5.25,
  bowlInnerWall: 4.7,
  bowlFloorY: -0.35,
  rimCenter: 4.62,
  rimTube: 0.3,
  pocketOuter: 4.35,
  pocketInner: 2.55,
  pocketFloorY: -0.16,
  fretH: 0.36,
  labelR: 3.62,
  coneR: 2.5,
  coneH: 0.95,
  hubR: 1.12,
  spindleR: 0.16,
  ballR: 0.19,
  ballOrbitR: 4.18, // spinning, near the rim track
  ballRestR: 3.55, // settled, sitting in a pocket
  ballSpinY: 0.42,
  ballRestY: 0.06,
} as const;

export const POCKET_HEX: Record<PocketColor, string> = {
  red: "#a1242e",
  black: "#171a21",
  green: "#1e7a4c",
};

export interface PocketDef {
  n: number;
  color: PocketColor;
  angle: number; // deg
}

export const POCKET_DEFS: PocketDef[] = WHEEL_ORDER.map((n, i) => ({ n, color: colorOf(n), angle: i * SECTOR_DEG }));

// ── number textures (one small canvas per digit-pair, cached) ────────────────
const numTexCache = new Map<number, THREE.CanvasTexture>();

export function numberTexture(n: number): THREE.CanvasTexture {
  const cached = numTexCache.get(n);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#f4ead2";
  ctx.font = "bold 76px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  ctx.fillText(String(n), size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  numTexCache.set(n, tex);
  return tex;
}
