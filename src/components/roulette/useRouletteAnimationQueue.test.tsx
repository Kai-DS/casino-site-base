// @vitest-environment jsdom
import { act } from "react";
import { useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimationEvent, SpinResult } from "@/games/roulette/types";
import { STANDARD_DURATIONS } from "./motion";
import { useRouletteAnimationQueue, type RouletteQueueView } from "./useRouletteAnimationQueue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RESULT: SpinResult = { number: 17, color: "black", parity: "odd", range: "low", dozen: 2, column: 2 };

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
const roots: Root[] = [];

function Harness({ initial, mode = "standard" }: { initial: AnimationEvent[]; mode?: "standard" | "full" | "reduced" }) {
  const [events, setEvents] = useState(initial);
  const onComplete = useCallback((id: string) => {
    setEvents((e) => (e[0]?.id === id ? e.slice(1) : e));
  }, []);
  latest = useRouletteAnimationQueue(events, onComplete, mode, false);
  return null;
}

function mount(initial: AnimationEvent[], mode: "standard" | "full" | "reduced" = "standard"): Root {
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(<Harness initial={initial} mode={mode} />));
  return root;
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  vi.useRealTimers();
});

describe("useRouletteAnimationQueue", () => {
  it("acks every event in order and ends idle (liveness)", () => {
    const seq = fullSpin();
    mount(seq);
    const seen: Array<string | undefined> = [latest.activeEvent?.type];
    for (const ev of seq) {
      advance(STANDARD_DURATIONS[ev.type] + 5);
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
      undefined, // queue drained → idle
    ]);
  });

  it("does not reveal the result before BALL_LAND's ack", () => {
    mount(fullSpin());
    expect(latest.activeEvent?.type).toBe("NO_MORE_BETS");
    expect(latest.resultRevealed).toBe(false);

    advance(STANDARD_DURATIONS.NO_MORE_BETS + 5); // → SPIN_START
    expect(latest.resultRevealed).toBe(false);

    advance(STANDARD_DURATIONS.SPIN_START + 5); // → BALL_LAND active
    expect(latest.activeEvent?.type).toBe("BALL_LAND");
    expect(latest.resultRevealed).toBe(false); // still hidden while the ball is in flight
    expect(latest.landedNumber).toBe(17); // landing angle is available, the reveal is not

    advance(STANDARD_DURATIONS.BALL_LAND + 5); // BALL_LAND completes
    expect(latest.resultRevealed).toBe(true);
    expect(latest.activeEvent?.type).toBe("MARK_WINNER");
  });

  it("resets the reveal accumulators on NO_MORE_BETS of the next spin", () => {
    const seq: AnimationEvent[] = [
      { id: "a1", type: "NO_MORE_BETS" },
      { id: "a2", type: "SPIN_START" },
      { id: "a3", type: "BALL_LAND", result: RESULT },
      { id: "a4", type: "RESULT_BANNER", result: RESULT, totalBet: 20, totalReturned: 360, profit: 340 },
      { id: "b1", type: "NO_MORE_BETS" }, // next spin starts
    ];
    mount(seq);
    advance(STANDARD_DURATIONS.NO_MORE_BETS + 5);
    advance(STANDARD_DURATIONS.SPIN_START + 5);
    advance(STANDARD_DURATIONS.BALL_LAND + 5);
    expect(latest.resultRevealed).toBe(true);
    advance(STANDARD_DURATIONS.RESULT_BANNER + 5); // banner plays, then the next NO_MORE_BETS starts
    expect(latest.activeEvent?.type).toBe("NO_MORE_BETS");
    expect(latest.resultRevealed).toBe(false);
    expect(latest.banner).toBeNull();
    expect(latest.landedNumber).toBeNull();
  });

  it("keeps an in-flight timer alive across an incidental re-render (mode change)", () => {
    const root = mount(fullSpin(), "standard");
    expect(latest.activeEvent?.type).toBe("NO_MORE_BETS"); // 500ms gate
    advance(200);
    // Re-render with a different mode mid-event — must NOT restart/reschedule the live timer.
    act(() => root.render(<Harness initial={fullSpin()} mode="full" />));
    advance(305); // 200 + 305 = 505ms > standard 500ms gate (would be < full's 700ms gate)
    expect(latest.activeEvent?.type).toBe("SPIN_START"); // original timer fired on its original schedule
  });
});
