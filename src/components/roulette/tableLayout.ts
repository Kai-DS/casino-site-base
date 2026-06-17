// components/roulette/tableLayout.ts
// UI-only geometry: positionId → hit-area in an SVG viewBox. The Perspective Redesign uses a LANDSCAPE
// board (spec §4.2, viewBox 0 0 940 360) for PC and keeps a PORTRAIT board for mobile (§10). Both are
// generated mechanically from the grid and emit the SAME 157 positionIds as constants/positions.ts —
// only the coordinates change (§4.6). This file is the UI's source for "where", never for legality.
import type { BetType, PositionId } from "@/games/roulette/types";
import { POSITION_TABLE } from "@/games/roulette/constants/positions";

export type ZoneLayer = "cell" | "outside" | "edge" | "corner";
export type Orientation = "landscape" | "portrait";

export interface HitZone {
  id: PositionId;
  kind: BetType;
  covered: readonly number[];
  label: string;
  /** rect in viewBox units */
  x: number;
  y: number;
  w: number;
  h: number;
  /** centre anchor (chips / number text) */
  cx: number;
  cy: number;
  layer: ZoneLayer;
}

export interface TableLayout {
  zones: readonly HitZone[];
  vbW: number;
  vbH: number;
}

function asc(nums: number[]): number[] {
  return [...nums].sort((a, b) => a - b);
}

function idFor(kind: BetType, nums: number[]): PositionId {
  const s = asc(nums);
  switch (kind) {
    case "straight":
      return `straight-${s[0]}`;
    case "split":
      return `split-${s.join("-")}`;
    case "street":
      return `street-${s.join("-")}`;
    case "corner":
      return `corner-${s.join("-")}`;
    case "sixLine":
      return `six-${s.join("-")}`;
    case "trio":
      return `trio-${s.join("-")}`;
    case "firstFour":
      return `first4-${s.join("-")}`;
    default:
      return kind;
  }
}

type Pusher = (
  kind: BetType,
  covered: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  layer: ZoneLayer,
  idOverride?: PositionId,
  labelOverride?: string,
) => void;

function makePush(zones: HitZone[]): Pusher {
  return (kind, covered, x, y, w, h, layer, idOverride, labelOverride) => {
    const id = idOverride ?? idFor(kind, covered);
    const def = POSITION_TABLE[id];
    zones.push({
      id,
      kind,
      covered: def ? def.coveredNumbers : asc(covered),
      label: labelOverride ?? def?.label ?? asc(covered).join("/"),
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
      layer,
    });
  };
}

// ── landscape (PC, spec §4.2): 0 left · 3 rows × 12 cols · 2:1 right · dozen · even-money ─────────
function buildLandscape(): TableLayout {
  const zones: HitZone[] = [];
  const push = makePush(zones);
  const CW = 64; // number cell width
  const RH = 72; // number cell row height
  const X0 = 90; // first number column x
  const Y0 = 20; // top row y
  const BAND = 17;
  const INSET = 11;

  const colX = (c: number) => X0 + c * CW; // left edge of grid column c (0..11)
  const rowY = (n: number) => Y0 + (2 - ((n - 1) % 3)) * RH; // top y for number n (上段=top row)
  const colOf = (n: number) => Math.floor((n - 1) / 3);

  // 0 — full-height cell on the left
  push("straight", [0], 26, Y0, CW, RH * 3, "cell");

  // straight number cells 1..36
  for (let n = 1; n <= 36; n += 1) {
    push("straight", [n], colX(colOf(n)), rowY(n), CW, RH, "cell");
  }

  // horizontal-adjacent splits (n, n+3) — vertical boundary between columns
  for (let c = 0; c < 11; c += 1) {
    for (let r = 0; r < 3; r += 1) {
      const n = 3 * c + 1 + r; // bottom=3c+1, middle=3c+2, top=3c+3
      const bx = colX(c + 1);
      push("split", [n, n + 3], bx - BAND / 2, rowY(n) + INSET, BAND, RH - 2 * INSET, "edge");
    }
  }
  // vertical-adjacent splits within a column — horizontal boundary between rows
  for (let c = 0; c < 12; c += 1) {
    const bottom = 3 * c + 1;
    push("split", [bottom, bottom + 1], colX(c) + INSET, rowY(bottom) - BAND / 2, CW - 2 * INSET, BAND, "edge"); // bottom-middle @ y=164
    push("split", [bottom + 1, bottom + 2], colX(c) + INSET, rowY(bottom + 2) + RH - BAND / 2, CW - 2 * INSET, BAND, "edge"); // middle-top @ y=92
  }
  // 0-splits (0/col0 vertical boundary), segmented by row
  for (let r = 0; r < 3; r += 1) {
    const n = 1 + r; // 1(bottom),2(mid),3(top)
    push("split", [0, n], X0 - BAND / 2, rowY(n) + INSET, BAND, RH - 2 * INSET, "edge");
  }

  // streets — column's 3 numbers; band on the bottom outer edge of each column
  for (let c = 0; c < 12; c += 1) {
    const a = 3 * c + 1;
    push("street", [a, a + 1, a + 2], colX(c) + INSET, Y0 + 3 * RH - BAND / 2, CW - 2 * INSET, BAND, "edge");
  }
  // six-lines — between adjacent columns at the bottom edge
  for (let c = 0; c < 11; c += 1) {
    const a = 3 * c + 1;
    push("sixLine", [a, a + 1, a + 2, a + 3, a + 4, a + 5], colX(c + 1) - BAND / 2, Y0 + 3 * RH - BAND / 2, BAND, BAND, "corner");
  }

  // corners — 4-cell grid intersections
  for (let c = 0; c < 11; c += 1) {
    const bx = colX(c + 1);
    push("corner", [3 * c + 2, 3 * c + 3, 3 * c + 5, 3 * c + 6], bx - BAND / 2, Y0 + RH - BAND / 2, BAND, BAND, "corner"); // top|middle
    push("corner", [3 * c + 1, 3 * c + 2, 3 * c + 4, 3 * c + 5], bx - BAND / 2, Y0 + 2 * RH - BAND / 2, BAND, BAND, "corner"); // middle|bottom
  }

  // trio / first-four on the 0|col0 boundary
  push("trio", [0, 2, 3], X0 - BAND / 2, Y0 + RH - BAND / 2, BAND, BAND, "corner"); // 0,2,3 top junction
  push("trio", [0, 1, 2], X0 - BAND / 2, Y0 + 2 * RH - BAND / 2, BAND, BAND, "corner"); // 0,1,2 bottom junction
  push("firstFour", [0, 1, 2, 3], X0 - BAND / 2, Y0 - BAND / 2, BAND, BAND, "corner"); // top-left corner

  // 2:1 columns (right) — column-3 top, column-2 mid, column-1 bottom
  const c21x = colX(12);
  push("column", [], c21x, Y0, 56, RH, "outside", "column-3", "2:1");
  push("column", [], c21x, Y0 + RH, 56, RH, "outside", "column-2", "2:1");
  push("column", [], c21x, Y0 + 2 * RH, 56, RH, "outside", "column-1", "2:1");

  // dozen row
  const dozenY = Y0 + 3 * RH; // 236
  const dozenLabels = ["1st 12", "2nd 12", "3rd 12"];
  for (let d = 0; d < 3; d += 1) {
    push("dozen", [], X0 + d * 256, dozenY, 256, 52, "outside", `dozen-${d + 1}`, dozenLabels[d]);
  }
  // even-money row
  const evenY = dozenY + 52; // 288
  const evens: Array<[PositionId, string]> = [
    ["low", "1-18"],
    ["even", "EVEN"],
    ["red", "RED"],
    ["black", "BLACK"],
    ["odd", "ODD"],
    ["high", "19-36"],
  ];
  evens.forEach(([id, label], i) => push(id as BetType, [], X0 + i * 128, evenY, 128, 52, "outside", id, label));

  return { zones, vbW: 940, vbH: 360 };
}

// ── portrait (mobile, §10): 0 top · 12 rows × 3 cols · 2:1 · dozen · even-money ─────────────────
function buildPortrait(): TableLayout {
  const zones: HitZone[] = [];
  const push = makePush(zones);
  const CW = 86;
  const RH = 56;
  const X0 = 30;
  const Y0 = 20;
  const BAND = 16;
  const INSET = 10;
  const NUM_W = 3 * CW;

  const colX = (c: number) => X0 + c * CW;
  const rowY = (r: number) => Y0 + r * RH; // r counts down (0 band at Y0)

  push("straight", [0], X0, Y0, NUM_W, RH, "cell"); // 0 across top
  for (let n = 1; n <= 36; n += 1) {
    const r = Math.ceil(n / 3);
    const c = (n - 1) % 3;
    push("straight", [n], colX(c), rowY(r), CW, RH, "cell");
  }
  for (let r = 1; r <= 12; r += 1) {
    const a = 3 * r - 2;
    push("split", [a, a + 1], colX(1) - BAND / 2, rowY(r) + INSET, BAND, RH - 2 * INSET, "edge");
    push("split", [a + 1, a + 2], colX(2) - BAND / 2, rowY(r) + INSET, BAND, RH - 2 * INSET, "edge");
  }
  for (let r = 1; r <= 11; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const n = 3 * r - 2 + c;
      push("split", [n, n + 3], colX(c) + INSET, rowY(r + 1) - BAND / 2, CW - 2 * INSET, BAND, "edge");
    }
  }
  for (let c = 0; c < 3; c += 1) push("split", [0, c + 1], colX(c) + INSET, rowY(1) - BAND / 2, CW - 2 * INSET, BAND, "edge");
  for (let r = 1; r <= 12; r += 1) {
    const a = 3 * r - 2;
    push("street", [a, a + 1, a + 2], X0 - BAND, rowY(r) + INSET, BAND, RH - 2 * INSET, "edge");
  }
  for (let r = 1; r <= 11; r += 1) {
    const a = 3 * r - 2;
    push("sixLine", [a, a + 1, a + 2, a + 3, a + 4, a + 5], X0 - BAND, rowY(r + 1) - BAND / 2, BAND, BAND, "corner");
  }
  for (let r = 1; r <= 11; r += 1) {
    const a = 3 * r - 2;
    for (let c = 0; c < 2; c += 1) {
      const tl = a + c;
      push("corner", [tl, tl + 1, tl + 3, tl + 4], colX(c + 1) - BAND / 2, rowY(r + 1) - BAND / 2, BAND, BAND, "corner");
    }
  }
  push("firstFour", [0, 1, 2, 3], X0 - BAND / 2, rowY(1) - BAND / 2, BAND, BAND, "corner");
  push("trio", [0, 1, 2], colX(1) - BAND / 2, rowY(1) - BAND / 2, BAND, BAND, "corner");
  push("trio", [0, 2, 3], colX(2) - BAND / 2, rowY(1) - BAND / 2, BAND, BAND, "corner");

  const colRowY = rowY(13);
  for (let c = 0; c < 3; c += 1) push("column", [], colX(c), colRowY, CW, RH, "outside", `column-${c + 1}`, "2:1");
  const dozenY = rowY(14);
  const dozenLabels = ["1st 12", "2nd 12", "3rd 12"];
  for (let d = 0; d < 3; d += 1) push("dozen", [], X0 + d * CW, dozenY, CW, RH, "outside", `dozen-${d + 1}`, dozenLabels[d]);
  const evenY = rowY(15);
  const evenW = NUM_W / 6;
  const evens: Array<[PositionId, string]> = [
    ["low", "1-18"],
    ["even", "EVEN"],
    ["red", "RED"],
    ["black", "BLACK"],
    ["odd", "ODD"],
    ["high", "19-36"],
  ];
  evens.forEach(([id, label], i) => push(id as BetType, [], X0 + i * evenW, evenY, evenW, RH, "outside", id, label));

  return { zones, vbW: NUM_W + 2 * X0, vbH: rowY(16) };
}

const LANDSCAPE = buildLandscape();
const PORTRAIT = buildPortrait();

export function buildTableLayout(orientation: Orientation): TableLayout {
  return orientation === "portrait" ? PORTRAIT : LANDSCAPE;
}

// Dev guard: every generated id must exist in the logic's position table (§4.6).
if (import.meta.env?.DEV) {
  for (const lay of [LANDSCAPE, PORTRAIT]) {
    const missing = lay.zones.filter((z) => !POSITION_TABLE[z.id]).map((z) => z.id);
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.error("[roulette tableLayout] unknown position ids:", missing);
    }
  }
}
