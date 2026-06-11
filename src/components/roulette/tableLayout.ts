// components/roulette/tableLayout.ts
// UI-only geometry: positionId → hit-area rectangle for the vertical 12×3 betting table
// (base spec §7.2). Hit zones are generated MECHANICALLY from the grid, and every id is built with
// the same convention as constants/positions.ts so placeChip(positionId) always resolves. This file
// is the UI's source for "where", never for "is it legal" — it must not import from logic/.
import type { BetType, PositionId } from "@/games/roulette/types";
import { POSITION_TABLE } from "@/games/roulette/constants/positions";

export type ZoneLayer = "cell" | "outside" | "edge" | "corner";

export interface HitZone {
  id: PositionId;
  kind: BetType;
  covered: readonly number[];
  label: string;
  /** Normalised rect (0..1 of board width/height). */
  x: number;
  y: number;
  w: number;
  h: number;
  layer: ZoneLayer;
}

export interface TableLayout {
  zones: readonly HitZone[];
  /** Board aspect ratio (width / height) so the container can size itself. */
  aspect: number;
}

// ── unit grid ────────────────────────────────────────────────────────────────
const COL_W = 10;
const ROW_H = 7;
const STREET_W = 4.2; // left strip for street / six-line zones
const NUM_X = STREET_W; // left edge of the number columns
const BAND = 2.6; // thickness of split/corner/six-line hit bands
const INSET = 1.6; // keep split bands off the cell corners

const NUM_W = 3 * COL_W;
const BOARD_W = STREET_W + NUM_W;
// 0 row + 12 number rows + column row + dozen row + even-money row
const BOARD_H = ROW_H * (1 + 12 + 1 + 1 + 1);

function asc(nums: number[]): number[] {
  return [...nums].sort((a, b) => a - b);
}

/** Same id convention as constants/positions.ts `idFor`. */
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
      return kind; // outside ids are literal
  }
}

function buildLayout(): TableLayout {
  const zones: HitZone[] = [];

  const push = (
    kind: BetType,
    covered: number[],
    x: number,
    y: number,
    w: number,
    h: number,
    layer: ZoneLayer,
    idOverride?: PositionId,
    labelOverride?: string,
  ) => {
    const id = idOverride ?? idFor(kind, covered);
    const def = POSITION_TABLE[id];
    zones.push({
      id,
      kind,
      covered: def ? def.coveredNumbers : asc(covered),
      label: labelOverride ?? def?.label ?? asc(covered).join("/"),
      x: x / BOARD_W,
      y: y / BOARD_H,
      w: w / BOARD_W,
      h: h / BOARD_H,
      layer,
    });
  };

  const colX = (c: number) => NUM_X + c * COL_W; // left edge of grid column c (0..2)
  const rowY = (r: number) => r * ROW_H; // top of number row r (1..12); row 0-band is y 0..ROW_H

  // 0 — full-width top cell
  push("straight", [0], NUM_X, 0, NUM_W, ROW_H, "cell");

  // straight number cells (1..36)
  for (let n = 1; n <= 36; n += 1) {
    const r = Math.ceil(n / 3);
    const c = (n - 1) % 3;
    push("straight", [n], colX(c), rowY(r), COL_W, ROW_H, "cell");
  }

  // ── inside edge bets ─────────────────────────────────────────────────────
  // horizontal splits (within a row): cols 0|1 and 1|2
  for (let r = 1; r <= 12; r += 1) {
    const a = 3 * r - 2;
    for (let c = 0; c < 2; c += 1) {
      const bx = colX(c + 1);
      push("split", [a + c, a + c + 1], bx - BAND / 2, rowY(r) + INSET, BAND, ROW_H - 2 * INSET, "edge");
    }
  }
  // vertical splits (between rows, same column) + 0-splits
  for (let r = 1; r <= 11; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const n = 3 * r - 2 + c;
      push("split", [n, n + 3], colX(c) + INSET, rowY(r + 1) - BAND / 2, COL_W - 2 * INSET, BAND, "edge");
    }
  }
  for (let c = 0; c < 3; c += 1) {
    push("split", [0, c + 1], colX(c) + INSET, ROW_H - BAND / 2, COL_W - 2 * INSET, BAND, "edge");
  }

  // streets (left strip, one per row)
  for (let r = 1; r <= 12; r += 1) {
    const a = 3 * r - 2;
    push("street", [a, a + 1, a + 2], 0, rowY(r) + INSET, STREET_W, ROW_H - 2 * INSET, "edge");
  }

  // six-lines (left strip, at row boundaries)
  for (let r = 1; r <= 11; r += 1) {
    const a = 3 * r - 2;
    push("sixLine", [a, a + 1, a + 2, a + 3, a + 4, a + 5], 0, rowY(r + 1) - BAND / 2, STREET_W, BAND, "corner");
  }

  // corners (grid intersections)
  for (let r = 1; r <= 11; r += 1) {
    const a = 3 * r - 2;
    for (let c = 0; c < 2; c += 1) {
      const cx = colX(c + 1);
      const tl = a + c;
      push("corner", [tl, tl + 1, tl + 3, tl + 4], cx - BAND / 2, rowY(r + 1) - BAND / 2, BAND, BAND, "corner");
    }
  }

  // trio / first-four on the 0|row1 boundary (column edges)
  push("firstFour", [0, 1, 2, 3], NUM_X - BAND / 2, ROW_H - BAND / 2, BAND, BAND, "corner");
  push("trio", [0, 1, 2], colX(1) - BAND / 2, ROW_H - BAND / 2, BAND, BAND, "corner");
  push("trio", [0, 2, 3], colX(2) - BAND / 2, ROW_H - BAND / 2, BAND, BAND, "corner");

  // ── outside bets ─────────────────────────────────────────────────────────
  const colRowY = rowY(13);
  for (let c = 0; c < 3; c += 1) {
    push("column", [], colX(c), colRowY, COL_W, ROW_H, "outside", `column-${c + 1}`, "2:1");
  }
  const dozenY = rowY(14);
  const dozenLabels = ["1st 12", "2nd 12", "3rd 12"];
  for (let d = 0; d < 3; d += 1) {
    push("dozen", [], NUM_X + d * COL_W, dozenY, COL_W, ROW_H, "outside", `dozen-${d + 1}`, dozenLabels[d]);
  }
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
  evens.forEach(([id, label], i) => {
    const kind = id as BetType;
    push(kind, [], NUM_X + i * evenW, evenY, evenW, ROW_H, "outside", id, label);
  });

  return { zones, aspect: BOARD_W / BOARD_H };
}

export const TABLE_LAYOUT: TableLayout = buildLayout();

// Dev-time guard: every generated hit-zone id must exist in the logic's position table, or a click
// would silently no-op. Surfaces id-format drift immediately.
if (import.meta.env?.DEV) {
  const missing = TABLE_LAYOUT.zones.filter((z) => !POSITION_TABLE[z.id]).map((z) => z.id);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error("[roulette tableLayout] unknown position ids:", missing);
  }
}
