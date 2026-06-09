// @vitest-environment jsdom
import { useCallback, useEffect, useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimationEvent, Card } from "../types";
import { durationFor } from "./motion";
import { useHoldemAnimationQueue } from "./useHoldemAnimationQueue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const card = (id: string): Card => ({ id, suit: "spades", rank: 14 });

// A representative queue spanning every "shape" of event the UI must play through.
function sampleEvents(): AnimationEvent[] {
  return [
    { id: "e1", type: "POST_BLIND", seat: 1, amount: 1 },
    { id: "e2", type: "POST_BLIND", seat: 2, amount: 2 },
    { id: "e3", type: "DEAL_HOLE", seat: 0, cardIndex: 0, faceUp: true },
    { id: "e4", type: "CPU_THINKING", seat: 1, ms: 300 },
    { id: "e5", type: "PLAYER_ACTION_LABEL", seat: 1, action: "call", amount: 2 },
    { id: "e6", type: "CHIP_TO_POT", seat: 1, amount: 2, potAfter: 5 },
    { id: "e7", type: "REVEAL_FLOP", cards: [card("s-2"), card("h-3"), card("d-4")] },
    { id: "e8", type: "AWARD_POT", seat: 0, amount: 5, isSplit: false },
    { id: "e9", type: "RESULT_BANNER", winners: [0], category: "one_pair" },
  ];
}

/**
 * Mirrors the real playback loop: the queue hook calls onAnimationEventComplete, and the
 * "logic" (here, this controller) drops the head event in response. The hand only advances
 * if completion is reported for every event — that is exactly what we assert.
 */
function Controller({
  initial,
  reduced,
  completed,
}: {
  initial: AnimationEvent[];
  reduced: boolean;
  completed: string[];
}) {
  const [events, setEvents] = useState<AnimationEvent[]>(initial);
  const onComplete = useCallback(
    (id: string) => {
      completed.push(id);
      setEvents((prev) => (prev[0]?.id === id ? prev.slice(1) : prev));
    },
    [completed],
  );
  useHoldemAnimationQueue(events, onComplete, reduced);
  // Force an unrelated re-render mid-flight to prove the completion timer survives it.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setTick((n) => n + 1), 5);
    return () => window.clearTimeout(t);
  }, [events]);
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function drain(completed: string[], events: AnimationEvent[], reduced: boolean) {
  act(() => {
    root.render(<Controller initial={events} reduced={reduced} completed={completed} />);
  });
  // Advance in steps until the queue drains (or we give up).
  for (let i = 0; i < 50 && completed.length < events.length; i++) {
    act(() => {
      vi.advanceTimersByTime(1100);
    });
  }
}

describe("useHoldemAnimationQueue", () => {
  it("completes every event exactly once, in order (liveness)", () => {
    const completed: string[] = [];
    const events = sampleEvents();
    drain(completed, events, false);

    expect(completed).toEqual(events.map((e) => e.id));
    // No double-fires despite the mid-flight re-renders.
    expect(new Set(completed).size).toBe(completed.length);
  });

  it("still consumes every event under reduced motion (only shortened, never skipped)", () => {
    const completed: string[] = [];
    const events = sampleEvents();
    drain(completed, events, true);

    expect(completed).toEqual(events.map((e) => e.id));
  });

  it("holds CPU_THINKING for its event-provided ms before completing", () => {
    const completed: string[] = [];
    const events: AnimationEvent[] = [{ id: "think", type: "CPU_THINKING", seat: 3, ms: 300 }];
    act(() => {
      root.render(<Controller initial={events} reduced={false} completed={completed} />);
    });

    act(() => {
      vi.advanceTimersByTime(durationFor(events[0]!, false) - 10);
    });
    expect(completed).toEqual([]); // not yet

    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(completed).toEqual(["think"]);
  });
});
