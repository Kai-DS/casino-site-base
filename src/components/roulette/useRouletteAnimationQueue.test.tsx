// @vitest-environment jsdom
import { act } from "react";
import { useCallback, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimationEvent, SpinResult } from "@/games/roulette/types";
import { STANDARD_DURATIONS } from "./motion";
import {
  LANDING_ESCAPE_RECHECK_MS,
  LANDING_ESCAPE_SLACK_MS,
  LANDING_SAFETY_SLACK_MS,
  useRouletteAnimationQueue,
  type RouletteQueueView,
} from "./useRouletteAnimationQueue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RESULT: SpinResult = { number: 17, color: "black", parity: "odd", range: "low", dozen: 2, column: 2 };
const LAND_MS = STANDARD_DURATIONS.BALL_LAND;

function fullSpin(prefix = "e"): AnimationEvent[] {
  return [
    { id: `${prefix}1`, type: "NO_MORE_BETS" },
    { id: `${prefix}2`, type: "SPIN_START" },
    { id: `${prefix}3`, type: "BALL_LAND", result: RESULT },
    { id: `${prefix}4`, type: "MARK_WINNER", number: 17 },
    { id: `${prefix}5`, type: "COLLECT_LOSING", betIds: ["b1"], totalLost: 10 },
    { id: `${prefix}6`, type: "PAY_WINNING", payouts: [{ betId: "b2", amount: 360 }], totalWon: 360 },
    { id: `${prefix}7`, type: "RESULT_BANNER", result: RESULT, totalBet: 20, totalReturned: 360, profit: 340 },
  ];
}

let latest: RouletteQueueView;
let reporter: { current: ((eventId: string) => void) | null };
let completeLog: string[];
const roots: Root[] = [];

// ── controllable rAF + visibility (so hidden-tab / paint gating is deterministic) ────────────────
let rafQueue: Array<FrameRequestCallback | undefined>;
let hidden = false;
function flushRaf() {
  act(() => {
    const q = rafQueue;
    rafQueue = [];
    q.forEach((cb) => cb?.(0));
  });
}
function setHidden(v: boolean) {
  hidden = v;
}

function Harness({ initial, mode = "standard" }: { initial: AnimationEvent[]; mode?: "standard" | "full" | "reduced" }) {
  const [events, setEvents] = useState(initial);
  const reporterRef = useRef<((eventId: string) => void) | null>(null);
  reporter = reporterRef;
  const onComplete = useCallback((id: string) => {
    completeLog.push(id);
    setEvents((e) => (e[0]?.id === id ? e.slice(1) : e));
  }, []);
  latest = useRouletteAnimationQueue(events, onComplete, mode, false, reporterRef);
  return null;
}

function mount(initial: AnimationEvent[], mode: "standard" | "full" | "reduced" = "standard"): Root {
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(<Harness initial={initial} mode={mode} />));
  return root;
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const reportLanding = (eventId: string) => act(() => reporter.current?.(eventId));
/** Reach the BALL_LAND-active state (NO_MORE_BETS + SPIN_START acked). */
function toBallLand() {
  advance(STANDARD_DURATIONS.NO_MORE_BETS + 5);
  advance(STANDARD_DURATIONS.SPIN_START + 5);
}

beforeEach(() => {
  vi.useFakeTimers();
  completeLog = [];
  rafQueue = [];
  hidden = false;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => rafQueue.push(cb));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    if (id >= 1) rafQueue[id - 1] = undefined;
  });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
});
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useRouletteAnimationQueue — completion model", () => {
  it("acks non-landing events on their timer and BALL_LAND only on the wheel report (liveness)", () => {
    const seq = fullSpin();
    mount(seq);
    const seen: Array<string | undefined> = [latest.activeEvent?.type];
    for (const ev of seq) {
      if (ev.type === "BALL_LAND") reportLanding(ev.id);
      else advance(STANDARD_DURATIONS[ev.type] + 5);
      seen.push(latest.activeEvent?.type);
    }
    expect(seen).toEqual([
      "NO_MORE_BETS",
      "SPIN_START",
      "BALL_LAND",
      "MARK_WINNER",
      "COLLECT_LOSING",
      "PAY_WINNING",
      "RESULT_BANNER",
      undefined,
    ]);
  });

  it("never reveals on landMs or on the force-finalize deadline — only on the wheel report", () => {
    mount(fullSpin());
    toBallLand();
    expect(latest.activeEvent?.type).toBe("BALL_LAND");
    expect(latest.landedNumber).toBe(17);
    expect(latest.resultRevealed).toBe(false);

    advance(LAND_MS + 5); // landMs alone: nothing
    expect(latest.resultRevealed).toBe(false);

    advance(LANDING_SAFETY_SLACK_MS); // force-finalize deadline → REQUEST only, not an ack
    expect(latest.forceFinalizeLanding).toBe(true);
    expect(latest.resultRevealed).toBe(false);
    expect(latest.activeEvent?.type).toBe("BALL_LAND");

    reportLanding("e3"); // the wheel finally reports the painted landing
    expect(latest.resultRevealed).toBe(true);
    expect(latest.activeEvent?.type).toBe("MARK_WINNER");
  });

  it("does NOT reveal while the tab is hidden, even past the escape deadline; reveals after visible+report", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(fullSpin());
    toBallLand();
    setHidden(true);

    advance(LAND_MS + LANDING_SAFETY_SLACK_MS + 5);
    expect(latest.forceFinalizeLanding).toBe(true);
    expect(latest.resultRevealed).toBe(false);

    advance(LANDING_ESCAPE_SLACK_MS + 5); // escape fires but tab is hidden → reschedules
    flushRaf();
    advance(LANDING_ESCAPE_RECHECK_MS * 3);
    flushRaf();
    expect(latest.resultRevealed).toBe(false); // hidden → still no reveal
    expect(warn).not.toHaveBeenCalled();

    setHidden(false); // tab becomes visible again
    reportLanding("e3"); // wheel applied final + painted after becoming visible
    expect(latest.resultRevealed).toBe(true);
    expect(latest.activeEvent?.type).toBe("MARK_WINNER");
    expect(completeLog.filter((id) => id === "e3")).toHaveLength(1);
    warn.mockRestore();
  });

  it("force-acks via the visibility+paint-gated escape ONLY when the wheel never reports", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(fullSpin());
    toBallLand();
    // stays visible; wheel never calls reportLanding
    advance(LAND_MS + LANDING_ESCAPE_SLACK_MS + 5); // escape fires → visible → schedules a paint
    expect(latest.resultRevealed).toBe(false); // not until a frame paints
    flushRaf(); // the escape's rAF → last-resort ack
    expect(latest.resultRevealed).toBe(true);
    expect(latest.activeEvent?.type).toBe("MARK_WINNER");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(completeLog.filter((id) => id === "e3")).toHaveLength(1);
    warn.mockRestore();
  });

  it("resets reveal accumulators on the next spin's NO_MORE_BETS", () => {
    const seq: AnimationEvent[] = [
      { id: "a1", type: "NO_MORE_BETS" },
      { id: "a2", type: "SPIN_START" },
      { id: "a3", type: "BALL_LAND", result: RESULT },
      { id: "a4", type: "RESULT_BANNER", result: RESULT, totalBet: 20, totalReturned: 360, profit: 340 },
      { id: "b1", type: "NO_MORE_BETS" },
    ];
    mount(seq);
    toBallLand();
    reportLanding("a3");
    expect(latest.resultRevealed).toBe(true);
    advance(STANDARD_DURATIONS.RESULT_BANNER + 5);
    expect(latest.activeEvent?.type).toBe("NO_MORE_BETS");
    expect(latest.resultRevealed).toBe(false);
    expect(latest.banner).toBeNull();
    expect(latest.landedNumber).toBeNull();
    expect(latest.forceFinalizeLanding).toBe(false);
  });

  it("keeps an in-flight timer alive across an incidental re-render (mode change)", () => {
    const root = mount(fullSpin(), "standard");
    expect(latest.activeEvent?.type).toBe("NO_MORE_BETS"); // 500ms gate
    advance(200);
    act(() => root.render(<Harness initial={fullSpin()} mode="full" />));
    advance(305); // 505 > standard 500 gate
    expect(latest.activeEvent?.type).toBe("SPIN_START");
  });
});

describe("useRouletteAnimationQueue — races & idempotency", () => {
  it("ignores stale / duplicate landing reports (at most once)", () => {
    mount(fullSpin());
    toBallLand();
    reportLanding("not-live"); // wrong id
    expect(latest.activeEvent?.type).toBe("BALL_LAND");
    expect(latest.resultRevealed).toBe(false);

    reportLanding("e3");
    expect(latest.activeEvent?.type).toBe("MARK_WINNER");
    reportLanding("e3"); // duplicate
    expect(latest.activeEvent?.type).toBe("MARK_WINNER");
    expect(completeLog.filter((id) => id === "e3")).toHaveLength(1);
  });

  it("wheel report wins the race with the escape (escape becomes a no-op)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(fullSpin());
    toBallLand();
    advance(LAND_MS + LANDING_ESCAPE_SLACK_MS + 5); // escape fired → rAF queued (not flushed yet)
    reportLanding("e3"); // wheel reports first
    expect(latest.resultRevealed).toBe(true);
    flushRaf(); // escape's rAF now runs — must be a no-op (already completed)
    expect(completeLog.filter((id) => id === "e3")).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("useRouletteAnimationQueue — unmount safety", () => {
  it("a reporter saved before unmount is inert afterwards (no onComplete, no setState)", () => {
    const root = mount(fullSpin());
    toBallLand();
    expect(latest.activeEvent?.type).toBe("BALL_LAND");
    const saved = reporter.current!; // capture before unmount
    expect(saved).toBeTypeOf("function");

    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);

    const before = completeLog.length;
    act(() => saved("e3")); // post-unmount call
    act(() => saved("e3")); // duplicate post-unmount call
    advance(LAND_MS + LANDING_ESCAPE_SLACK_MS + 5000); // any straggler timers
    flushRaf();
    expect(completeLog.length).toBe(before); // nothing advanced
    expect(reporter.current).toBeNull(); // cleanup nulled the shared ref (it was still ours)
  });

  it("after remount, only the new instance's reporter works", () => {
    const rootA = mount(fullSpin("a"));
    toBallLand();
    const savedA = reporter.current!;
    act(() => rootA.unmount());
    roots.splice(roots.indexOf(rootA), 1);

    mount(fullSpin("b")); // fresh instance
    toBallLand();
    expect(latest.activeEvent?.type).toBe("BALL_LAND");

    act(() => savedA("a3")); // old generation → inert
    expect(latest.activeEvent?.type).toBe("BALL_LAND");

    reportLanding("b3"); // new instance's live reporter
    expect(latest.activeEvent?.type).toBe("MARK_WINNER");
    expect(completeLog).toContain("b3");
    expect(completeLog).not.toContain("a3");
  });
});
