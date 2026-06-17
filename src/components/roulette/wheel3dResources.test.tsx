// @vitest-environment jsdom
// Resource-ownership / disposal lifecycle for useWheelResources (audit #6 / §20). jsdom has no WebGL,
// so we stub the 2D canvas context; geometry/material/texture construction + dispose() are pure JS and
// need no GPU. This proves the HOOK disposes every resource it owns exactly once, and that each mount
// gets fresh instances (no reuse of a disposed resource).
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWheelResources } from "./RouletteWheel3D";
import { R, buildFretGeometry } from "./wheel3dGeometry";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Res = NonNullable<ReturnType<typeof useWheelResources>>;
let captured: Res | null = null;
const roots: Root[] = [];

function Probe() {
  const res = useWheelResources();
  if (res) captured = res;
  return null;
}

function mountProbe(strict = false) {
  captured = null;
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(strict ? <StrictMode><Probe /></StrictMode> : <Probe />));
  return root;
}

const stubCtx = () =>
  ({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText() {},
    strokeText() {},
  }) as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => stubCtx());
});
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  vi.restoreAllMocks();
});

describe("useWheelResources — ownership & disposal", () => {
  it("builds every owned resource on commit and disposes each exactly once on unmount", () => {
    const root = mountProbe();
    const res = captured!;
    expect(res).toBeTruthy();
    expect(res.numbers).toHaveLength(37);

    const owned = [res.bowlGeom, res.bowlMat, res.floorGeom, res.floorMat, res.fretGeom, res.fretMat, res.pocketFrameGeom, res.woodTex, res.shadowTex, res.numbers[0]!.tex, res.numbers[36]!.tex];
    const spies = owned.map((o) => vi.spyOn(o, "dispose"));

    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);

    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1); // disposed once — no double, none missed
  });

  it("hands a fresh instance to each mount (never reuses a disposed resource)", () => {
    const rootA = mountProbe();
    const a = captured!;
    act(() => rootA.unmount());
    roots.splice(roots.indexOf(rootA), 1);

    const rootB = mountProbe();
    const b = captured!;

    expect(b.bowlGeom).not.toBe(a.bowlGeom);
    expect(b.bowlMat).not.toBe(a.bowlMat);
    expect(b.floorGeom).not.toBe(a.floorGeom);
    expect(b.fretGeom).not.toBe(a.fretGeom);
    expect(b.fretMat).not.toBe(a.fretMat);
    expect(b.pocketFrameGeom).not.toBe(a.pocketFrameGeom);
    expect(b.woodTex).not.toBe(a.woodTex);
    expect(b.numbers[0]!.tex).not.toBe(a.numbers[0]!.tex);

    act(() => rootB.unmount());
    roots.splice(roots.indexOf(rootB), 1);
  });

  it("survives Strict Mode mount→cleanup→mount and disposes the live set once on unmount", () => {
    const root = mountProbe(true);
    const res = captured!; // the kept (second) set; the throwaway first set was already disposed
    expect(res).toBeTruthy();
    const spy = vi.spyOn(res.bowlGeom, "dispose");

    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("fret fins — central-only short separators (fret/motion fix §2)", () => {
  it("sit in the inner part of the bay and never reach the number ring / ball rest", () => {
    expect(R.fretInnerR).toBeGreaterThan(R.pocketInner); // start outside the pocket inner wall / cone
    expect(R.fretOuterR).toBeLessThan(R.numberR); // stop well before the number plates
    expect(R.fretOuterR).toBeLessThanOrEqual(R.ballRestR); // …and before the resting ball — open outer area
    expect(R.fretCenterR).toBeCloseTo((R.fretInnerR + R.fretOuterR) / 2, 5);
    // a clearly short fin (covers far less than half the pocket band) and a modest height
    const bandLen = R.pocketOuter - R.pocketInner;
    expect(R.fretOuterR - R.fretInnerR).toBeLessThan(bandLen * 0.5);
    expect(R.fretH).toBeLessThan(0.25);
  });

  it("buildFretGeometry returns a small wedge whose base is at the floor and within the fin span", () => {
    const g = buildFretGeometry();
    const pos = g.getAttribute("position");
    expect(pos).toBeTruthy();
    let minY = Infinity;
    let maxY = -Infinity;
    let maxAbsZ = 0;
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
      maxAbsZ = Math.max(maxAbsZ, Math.abs(pos.getZ(i)));
    }
    expect(minY).toBeCloseTo(0, 5); // base on the floor (positioned at floorY)
    expect(maxY).toBeCloseTo(R.fretH, 5); // inner-edge height
    expect(maxAbsZ).toBeCloseTo((R.fretOuterR - R.fretInnerR) / 2, 5); // radial half-length
    g.dispose();
  });
});
