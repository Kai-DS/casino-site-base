// components/roulette/wheel3dGeometry.ts
// Procedural geometry constants + builders for the cinematic 3D wheel (§9/§10). The pocket ORDER and
// the landing angle come ONLY from WHEEL_ORDER / angleOf (single source, §10/§13) — the 3D layer never
// derives the result from an angle. Everything below describes a real European wheel cross-section:
// wooden bowl → polished ball track → sloped apron with diamond deflectors → recessed numbered pockets
// separated by brass frets → central cone + turret. Radii/heights are mutually consistent so the ball
// orbits ON the track and settles INSIDE a pocket (never floating on the number ring).
import * as THREE from "three";
import { WHEEL_ORDER, colorOf, type PocketColor } from "@/games/roulette/constants/wheel";

export const POCKETS = WHEEL_ORDER.length; // 37
export const SECTOR_RAD = (Math.PI * 2) / POCKETS;
export const SECTOR_DEG = 360 / POCKETS;

/** Angle (deg, 0 = far side "top", clockwise) of pocket n — same convention as the SVG wheel (§10/§13.1). */
export function angleOf(n: number): number {
  const i = WHEEL_ORDER.indexOf(n as (typeof WHEEL_ORDER)[number]);
  return i < 0 ? 0 : i * SECTOR_DEG;
}

/** World position on the horizontal wheel for an angle (deg) + radius. angle 0 → -Z (far side). */
export function posAt(angleDeg: number, radius: number, y = 0): [number, number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [radius * Math.sin(a), y, -radius * Math.cos(a)];
}

/**
 * Convert this module's wheel angle convention to a Three.js Y rotation.
 * `posAt(+angle)` advances clockwise in wheel space, while positive Three.js
 * Y rotation moves the local -Z point the opposite way, so rotor children that
 * are built around local angle 0 must use the negative sign.
 */
export function rotationYForWheelAngle(angleDeg: number): number {
  return -(angleDeg * Math.PI) / 180;
}

// ── radii / heights (world units; wheel ≈ ⌀11) ───────────────────────────────
// The ball orbits at trackR/ballSpinY (sitting in the track channel) and settles at
// pocketMidR/ballRestY (nestled on a pocket floor, flush with the fret tops).
export const R = {
  bowlOuterR: 5.5,
  rimR: 4.95, // gold decorative rim torus centre
  rimTube: 0.16,

  // ball track (fast orbit)
  trackR: 4.5,
  trackY: 0.34,

  // sloped apron + diamond deflectors
  apronOuterR: 4.28,
  apronInnerR: 3.98,
  deflectorR: 4.12,
  deflectorY: 0.2,

  // recessed pocket ring (rotor)
  pocketOuter: 3.9,
  pocketInner: 2.62,
  pocketMidR: 3.26,
  floorY: -0.3,
  numberR: 3.6, // number plates sit outboard of the resting ball

  // separators: short radial brass FINS near the centre only. They span fretInner→fretOuter (the inner
  // ~third of the bay), tall at the inner edge and tapering to the floor at the outer edge — so the
  // number ring / ball area stays open and smooth, with no tall wall reaching the digits.
  fretInnerR: 2.72,
  fretOuterR: 3.18,
  fretCenterR: 2.95,
  fretH: 0.2, // inner-edge height (tapers to 0 at fretOuterR)

  // centre cone / hub / turret
  coneBaseR: 2.6,
  coneH: 0.95,
  hubR: 0.62,
  spindleR: 0.13,

  // ball
  ballR: 0.16,
  ballOrbitR: 4.5, // ≡ trackR (spinning)
  ballRestR: 3.26, // ≡ pocketMidR (settled)
  ballSpinY: 0.5, // centre height on the track (bottom ≈ trackY)
  ballRestY: -0.12, // centre height settled in a pocket (top ≈ fret crest)
} as const;

export const POCKET_HEX: Record<PocketColor, string> = {
  red: "#c42a36",
  black: "#1b202b",
  green: "#1f8a57",
};

export interface PocketDef {
  n: number;
  color: PocketColor;
  angle: number; // deg (centre)
}

export const POCKET_DEFS: PocketDef[] = WHEEL_ORDER.map((n, i) => ({ n, color: colorOf(n), angle: i * SECTOR_DEG }));

/** Fret boundary angles (deg) — one between every adjacent pair of pockets. */
export const FRET_ANGLES: number[] = POCKET_DEFS.map((_, i) => (i + 0.5) * SECTOR_DEG);

/** Diamond deflector angles (deg) — 8 around the apron, like a real wheel. */
export const DEFLECTOR_ANGLES: number[] = Array.from({ length: 8 }, (_, k) => k * 45);

// ── revolved bowl profile (Vector2(radius, y), outer → inner) ────────────────
// Revolved 360° into the wooden bowl: outer wall → rim crown → polished ball track channel →
// sloped apron → pocket outer wall. The rotor's pocket floor sits just inside the bottom of this.
export function bowlProfile(): THREE.Vector2[] {
  return [
    new THREE.Vector2(5.5, 0.12), // outer skirt
    new THREE.Vector2(5.5, 0.62), // outer wall
    new THREE.Vector2(5.18, 0.74), // rim crown
    new THREE.Vector2(4.98, 0.6), // crown inner
    new THREE.Vector2(4.78, 0.42), // track outer wall
    new THREE.Vector2(4.62, 0.34), // into channel
    new THREE.Vector2(4.5, 0.32), // channel low (ball orbits here)
    new THREE.Vector2(4.4, 0.34), // channel inner lip
    new THREE.Vector2(4.28, 0.24), // apron upper
    new THREE.Vector2(4.05, 0.02), // apron lower
    new THREE.Vector2(3.95, -0.1), // pocket outer top
    new THREE.Vector2(3.9, -0.3), // pocket outer wall to floor
    new THREE.Vector2(3.84, -0.33), // static floor lip (just inside)
  ];
}

// ── recessed pocket floor (one vertex-coloured annulus, 37 bays) ─────────────
// Built from posAt so bay i is EXACTLY at world angle i·SECTOR_DEG and shows WHEEL_ORDER[i]'s colour.
// Vertex colours (not a texture) keep bay boundaries crisp and avoid any UV-mirroring ambiguity.
export function buildFloorGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const outer = R.pocketOuter;
  const inner = R.pocketInner;
  const y = R.floorY;
  const c = new THREE.Color();
  const cInner = new THREE.Color();

  POCKET_DEFS.forEach((p, i) => {
    const a0 = (i - 0.5) * SECTOR_DEG;
    const a1 = (i + 0.5) * SECTOR_DEG;
    const A = posAt(a0, outer, y);
    const B = posAt(a1, outer, y);
    const C = posAt(a1, inner, y);
    const D = posAt(a0, inner, y);
    const base = i * 4;
    for (const v of [A, B, C, D]) {
      positions.push(v[0], v[1], v[2]);
      normals.push(0, 1, 0);
    }
    c.set(POCKET_HEX[p.color]).convertSRGBToLinear();
    cInner.copy(c).multiplyScalar(0.8); // gently darken toward the inner wall for a recessed read
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b, cInner.r, cInner.g, cInner.b, cInner.r, cInner.g, cInner.b);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  return g;
}

// ── separator fin (short radial wedge: tall at the inner edge, tapering to the floor outward) ──
// Local frame: x = tangential (thin), y = up from the floor (base at y=0), z = radial (−inner / +outer).
// One geometry, instanced 37× at the fret boundaries. Faceted look via flatShading on the material.
export function buildFretGeometry(): THREE.BufferGeometry {
  const t = 0.05; // tangential thickness
  const hz = (R.fretOuterR - R.fretInnerR) / 2; // half radial length, centred on fretCenterR
  const h = R.fretH; // inner-edge height
  // 6 verts: L*=−x side, R*=+x side; 0=inner-bottom, 1=inner-top, 2=outer-tip(floor)
  const pos = [
    -t / 2, 0, -hz, -t / 2, h, -hz, -t / 2, 0, hz, // L0,L1,L2
    t / 2, 0, -hz, t / 2, h, -hz, t / 2, 0, hz, // R0,R1,R2
  ];
  const idx = [
    0, 2, 1, // left cap (−X)
    3, 4, 5, // right cap (+X)
    0, 1, 4, 0, 4, 3, // inner face (−Z, toward cone)
    0, 3, 5, 0, 5, 2, // bottom (−Y)
    1, 2, 5, 1, 5, 4, // sloped top (inner-top → outer-tip)
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ── winning-pocket FRAME (replaces the old disc marker) ──────────────────────
// A short glowing CURB tracing the border of ONE bay — four low vertical walls (outer arc, inner arc, two
// sides) around the bay between pocketInner..pocketOuter and ±SECTOR_DEG/2. Built centred at angle 0 with
// its base at y=0, so the mesh is just placed at floorY and rotated with rotationYForWheelAngle(angleOf(winner))
// (it rides the rotor). The walls sit OUTSIDE the digit (centre of the bay), so the number is never covered,
// and being upright they read clearly from the elevated 3/4 camera (a flat decal would foreshorten away).
export function buildPocketFrameGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const half = SECTOR_DEG / 2;
  const ri = R.pocketInner + 0.1;
  const ro = R.pocketOuter - 0.1;
  const h = 0.14; // curb height
  const N = 8; // arc segments
  // a vertical ribbon following ground points (radius, angleDeg), raised to height h
  const wall = (pts: Array<[number, number]>) => {
    const base = positions.length / 3;
    for (const [r, a] of pts) {
      const g = posAt(a, r, 0);
      positions.push(g[0], 0, g[2], g[0], h, g[2]); // base, top
    }
    for (let i = 0; i < pts.length - 1; i += 1) {
      const b = base + i * 2;
      indices.push(b, b + 1, b + 3, b, b + 3, b + 2);
    }
  };
  const arc = (r: number): Array<[number, number]> =>
    Array.from({ length: N + 1 }, (_, i) => [r, -half + (SECTOR_DEG * i) / N]);
  wall(arc(ro)); // outer wall
  wall(arc(ri)); // inner wall
  wall([[ri, -half], [ro, -half]]); // left wall
  wall([[ri, half], [ro, half]]); // right wall

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// ── per-number plate texture (crisp, oriented by the mesh; cached by the caller) ─────────────
export function buildNumberTexture(n: number): THREE.CanvasTexture {
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 108px Georgia, 'Times New Roman', serif";
  // dark outline so single/double digits stay legible on red, black and green
  ctx.lineWidth = 11;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(String(n), size / 2, size / 2 + 4);
  ctx.fillStyle = "#fff7e4";
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 3;
  ctx.fillText(String(n), size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── procedural turned-wood texture for the bowl/cone (lathe grain rings) ──────
export function buildWoodTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#5a3a1f");
  grad.addColorStop(0.5, "#3c2511");
  grad.addColorStop(1, "#26160b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // grain rings run AROUND the lathe → horizontal wavy lines in (u=around, v=profile) space
  for (let i = 0; i < 64; i++) {
    const y = (i / 64) * h + (Math.sin(i * 1.7) * 1.6);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) {
      ctx.lineTo(x, y + Math.sin((x / w) * Math.PI * 4 + i) * 1.3);
    }
    const dark = i % 3 === 0;
    ctx.strokeStyle = dark ? "rgba(20,10,4,0.5)" : "rgba(120,80,40,0.14)";
    ctx.lineWidth = dark ? 1.4 : 0.8;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(3, 1);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── soft baked contact shadow (radial gradient on a ground plane) ────────────
export function buildShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.7, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
