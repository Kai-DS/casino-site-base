// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouletteWheelFallback, type RouletteWheelFallbackProps } from "./RouletteWheelFallback";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LAND_MS = 2200;
const NOW = 100_000; // fixed performance.now() for the whole test

const roots: Root[] = [];
let rafQueue: Array<FrameRequestCallback | undefined>;
function flushRaf() {
  act(() => {
    const q = rafQueue;
    rafQueue = [];
    q.forEach((cb) => cb?.(0));
  });
}

const base: RouletteWheelFallbackProps = {
  activeEventType: "BALL_LAND",
  landedNumber: 17,
  resultRevealed: false,
  dollyNumber: null,
  mode: "standard",
  spinMs: 1600,
  landMs: LAND_MS,
  landEventId: "e3",
  onLandingComplete: () => {},
  landingStartedAtMs: NOW, // fresh landing by default
  forceFinalizeLanding: false,
};

function render(initial: Partial<RouletteWheelFallbackProps>) {
  let props = { ...base, ...initial };
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(<RouletteWheelFallback {...props} />));
  return {
    root,
    rerender(next: Partial<RouletteWheelFallbackProps>) {
      props = { ...props, ...next };
      act(() => root.render(<RouletteWheelFallback {...props} />));
    },
  };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  rafQueue = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => rafQueue.push(cb));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    if (id >= 1) rafQueue[id - 1] = undefined;
  });
  vi.spyOn(performance, "now").mockReturnValue(NOW);
});
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("RouletteWheelFallback — landing report (§17)", () => {
  it("reports once, only after the settle time AND a paint", () => {
    const onLandingComplete = vi.fn();
    render({ onLandingComplete, landingStartedAtMs: NOW }); // fresh → waits full landMs

    advance(LAND_MS - 10);
    flushRaf();
    expect(onLandingComplete).not.toHaveBeenCalled(); // settle not finished

    advance(20); // settle timer fires → schedules a paint, but does not report yet
    expect(onLandingComplete).not.toHaveBeenCalled();

    flushRaf(); // the paint → report
    expect(onLandingComplete).toHaveBeenCalledTimes(1);
    expect(onLandingComplete).toHaveBeenCalledWith("e3");
  });

  it("inherits elapsed time on a mid-landing mount (only waits the remainder)", () => {
    const onLandingComplete = vi.fn();
    render({ onLandingComplete, landingStartedAtMs: NOW - LAND_MS / 2 }); // half already elapsed

    advance(LAND_MS / 2 - 10);
    flushRaf();
    expect(onLandingComplete).not.toHaveBeenCalled();

    advance(20);
    flushRaf();
    expect(onLandingComplete).toHaveBeenCalledTimes(1);
  });

  it("finalizes immediately when already overdue (remaining = 0)", () => {
    const onLandingComplete = vi.fn();
    render({ onLandingComplete, landingStartedAtMs: NOW - LAND_MS * 2 }); // long overdue

    advance(0); // setTimeout(0) fires → schedules paint
    flushRaf();
    expect(onLandingComplete).toHaveBeenCalledTimes(1);
  });

  it("snaps and reports on the next paint when force-finalize is requested mid-settle", () => {
    const onLandingComplete = vi.fn();
    const h = render({ onLandingComplete, landingStartedAtMs: NOW }); // would otherwise wait landMs

    advance(LAND_MS / 4); // partway through the settle
    expect(onLandingComplete).not.toHaveBeenCalled();

    h.rerender({ forceFinalizeLanding: true }); // queue's force-finalize deadline
    advance(0);
    flushRaf();
    expect(onLandingComplete).toHaveBeenCalledTimes(1);
  });

  it("clears the pending report when the active event leaves BALL_LAND (stale ack cancelled)", () => {
    const onLandingComplete = vi.fn();
    const h = render({ onLandingComplete, landingStartedAtMs: NOW });
    advance(LAND_MS - 50); // still settling, report not yet scheduled to fire
    h.rerender({ activeEventType: "MARK_WINNER" }); // e.g. queue escape already acked elsewhere
    advance(LAND_MS);
    flushRaf();
    expect(onLandingComplete).not.toHaveBeenCalled();
  });

  it("does not report a stale event id after a new landing starts", () => {
    const onLandingComplete = vi.fn();
    const h = render({ onLandingComplete, landingStartedAtMs: NOW });
    advance(LAND_MS / 3);
    // a new spin begins: NO_MORE_BETS clears the old report, then a new BALL_LAND with a new id
    h.rerender({ activeEventType: "NO_MORE_BETS" });
    advance(LAND_MS); // old e3 report must be cancelled
    flushRaf();
    expect(onLandingComplete).not.toHaveBeenCalled();

    h.rerender({ activeEventType: "BALL_LAND", landEventId: "x9", landingStartedAtMs: NOW });
    advance(LAND_MS);
    flushRaf();
    expect(onLandingComplete).toHaveBeenCalledTimes(1);
    expect(onLandingComplete).toHaveBeenCalledWith("x9");
  });

  it("clears timers on unmount (no report, no error)", () => {
    const onLandingComplete = vi.fn();
    const h = render({ onLandingComplete, landingStartedAtMs: NOW });
    advance(LAND_MS - 50);
    act(() => h.root.unmount());
    roots.splice(roots.indexOf(h.root), 1);
    advance(LAND_MS * 2);
    flushRaf();
    expect(onLandingComplete).not.toHaveBeenCalled();
  });
});
