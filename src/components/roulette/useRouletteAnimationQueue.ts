// components/roulette/useRouletteAnimationQueue.ts
// Plays the logic's AnimationEvent queue for roulette and — most importantly — calls
// onAnimationEventComplete(id) for every event so the spin can advance (base spec §6.2, addendum §7.4).
//
// Invariants this hook guards:
//  • Liveness. Non-landing events are timer-driven (durationFor → setTimeout → ack). BALL_LAND is acked
//    ONLY by the rendered wheel's landing-complete report (§17) — never directly by a timer — so the
//    result can never reveal before the ball has actually settled AND a frame has painted.
//  • ★ Result-hiding gate (`resultRevealed`, §8): the logic has `settlement` ready at spin() time, but
//    the UI reveals nothing until BALL_LAND completes. resultRevealed flips true ONLY inside
//    completeEvent for BALL_LAND, which only runs from a wheel report (or, last resort, the visibility-
//    and-paint-gated escape). While the tab is hidden, rAF is paused → the wheel cannot report → no
//    reveal. The force-finalize timer only ASKS the wheel to finish; it never acks by itself.
//  • Instance safety. A reporter saved by the parent can outlive this hook; a mountedRef + identity
//    nulling make every post-unmount call (and any stale generation) a no-op (no setState / onComplete).
//  • visualFocus (§5/§6) is the UI "camera"; FULL adds a cosmetic mid-event focus switch (does not ack).
//  • Accumulators reset on NO_MORE_BETS (each spin's first event).
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { AnimationEvent, SpinResult } from "@/games/roulette/types";
import { type RouletteAnimationMode, type RouletteVisualFocus, effectiveAnimationMode } from "./animationMode";
import { durationFor, focusPlan } from "./motion";
import { playRouletteSound } from "./rouletteSound";

/** After landMs + this, the queue ASKS the wheel to force-finalize its landing (it still does NOT ack). */
export const LANDING_SAFETY_SLACK_MS = 1500;
/** After landMs + this, with no wheel report at all, the visibility+paint-gated escape acks (last resort). */
export const LANDING_ESCAPE_SLACK_MS = 6000;
/** While hidden, the escape re-checks on this interval until the tab is visible again. */
export const LANDING_ESCAPE_RECHECK_MS = 1000;

const nowMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
const isHidden = (): boolean => typeof document !== "undefined" && document.hidden === true;
const requestPaint = (cb: FrameRequestCallback): number =>
  typeof window !== "undefined" && window.requestAnimationFrame
    ? window.requestAnimationFrame(cb)
    : (window.setTimeout(() => cb(nowMs()), 16) as unknown as number);
const cancelPaint = (id: number): void => {
  if (typeof window !== "undefined" && window.cancelAnimationFrame) window.cancelAnimationFrame(id);
  else window.clearTimeout(id);
};

export interface RouletteBannerView {
  result: SpinResult;
  totalBet: number;
  totalReturned: number;
  profit: number;
}

export interface RouletteQueueView {
  /** The event currently being played (null = idle). */
  activeEvent: AnimationEvent | null;
  /** UI "camera" state (addendum §5). */
  visualFocus: RouletteVisualFocus;
  /** False until BALL_LAND completes (wheel report) — gates ALL settlement-derived display (§8). */
  resultRevealed: boolean;
  /** Winning number from BALL_LAND payload. Usable pre-reveal ONLY for the ball landing angle. */
  landedNumber: number | null;
  /** performance.now() when BALL_LAND became the head — lets a late-mounting wheel inherit elapsed time. */
  landingStartedAtMs: number | null;
  /** True once the force-finalize deadline passed — the wheel should snap to final and report (§17). */
  forceFinalizeLanding: boolean;
  /** Dolly/marker number (MARK_WINNER) — post-reveal. */
  dollyNumber: number | null;
  /** Losing bet ids being collected (COLLECT_LOSING). */
  collectedBetIds: ReadonlySet<string>;
  /** Winning bet ids being paid (PAY_WINNING). */
  paidBetIds: ReadonlySet<string>;
  /** Result banner (RESULT_BANNER) — post-reveal. */
  banner: RouletteBannerView | null;
}

interface Accumulators {
  focus: RouletteVisualFocus;
  resultRevealed: boolean;
  landedNumber: number | null;
  landingStartedAtMs: number | null;
  forceFinalizeLanding: boolean;
  dollyNumber: number | null;
  collectedBetIds: Set<string>;
  paidBetIds: Set<string>;
  banner: RouletteBannerView | null;
}

function freshAccumulators(): Accumulators {
  return {
    focus: "table",
    resultRevealed: false,
    landedNumber: null,
    landingStartedAtMs: null,
    forceFinalizeLanding: false,
    dollyNumber: null,
    collectedBetIds: new Set(),
    paidBetIds: new Set(),
    banner: null,
  };
}

/** NO_MORE_BETS is the first event of each spin → clear per-spin reveal accumulators (§8.3). */
function resetForNewSpin(acc: Accumulators): void {
  acc.resultRevealed = false;
  acc.landedNumber = null;
  acc.landingStartedAtMs = null;
  acc.forceFinalizeLanding = false;
  acc.dollyNumber = null;
  acc.collectedBetIds = new Set();
  acc.paidBetIds = new Set();
  acc.banner = null;
}

function snapshot(acc: Accumulators, activeEvent: AnimationEvent | null): RouletteQueueView {
  return {
    activeEvent,
    visualFocus: acc.focus,
    resultRevealed: acc.resultRevealed,
    landedNumber: acc.landedNumber,
    landingStartedAtMs: acc.landingStartedAtMs,
    forceFinalizeLanding: acc.forceFinalizeLanding,
    dollyNumber: acc.dollyNumber,
    collectedBetIds: new Set(acc.collectedBetIds),
    paidBetIds: new Set(acc.paidBetIds),
    banner: acc.banner,
  };
}

export function useRouletteAnimationQueue(
  events: readonly AnimationEvent[],
  onComplete: (eventId: string) => void,
  mode: RouletteAnimationMode,
  reducedMotion: boolean,
  /** The hook writes its landing-complete reporter here; the wheel calls it when the ball settles. */
  landingReporterRef?: MutableRefObject<((eventId: string) => void) | null>,
): RouletteQueueView {
  const accRef = useRef<Accumulators>(freshAccumulators());
  const [view, setView] = useState<RouletteQueueView>(() => snapshot(accRef.current, null));

  const timerRef = useRef<number | null>(null); // non-landing ack timer
  const focusTimerRef = useRef<number | null>(null); // cosmetic mid-event focus switch
  const finalizeTimerRef = useRef<number | null>(null); // BALL_LAND: ask the wheel to force-finalize
  const escapeTimerRef = useRef<number | null>(null); // BALL_LAND: catastrophic last-resort ack
  const escapeRafRef = useRef<number | null>(null);
  const playingRef = useRef<string | null>(null);
  const scheduledRef = useRef<string | null>(null); // the event id we've already armed timers for
  const completedRef = useRef<string | null>(null);
  const headRef = useRef<AnimationEvent | null>(null);
  const mountedRef = useRef(true); // false once this hook instance has unmounted
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearAllTimers = useCallback(() => {
    for (const r of [timerRef, focusTimerRef, finalizeTimerRef, escapeTimerRef]) {
      if (r.current !== null) {
        window.clearTimeout(r.current);
        r.current = null;
      }
    }
    if (escapeRafRef.current !== null) {
      cancelPaint(escapeRafRef.current);
      escapeRafRef.current = null;
    }
  }, []);

  // Single, idempotent ack path for the active event. At most once per id; ignored when this hook has
  // unmounted, when the id is not the live head (stale / superseded spin), or when already acked.
  const completeEvent = useCallback(
    (eventId: string) => {
      if (!mountedRef.current) return; // hook gone — a saved reporter / late timer must be inert
      if (playingRef.current !== eventId) return; // not the active event
      if (completedRef.current === eventId) return; // already acked (double-fire guard)
      clearAllTimers();
      completedRef.current = eventId;
      const head = headRef.current;
      // ★ Result-hiding gate (§8.3): reveal ONLY when BALL_LAND's landing has actually completed.
      if (head && head.id === eventId && head.type === "BALL_LAND") {
        accRef.current.resultRevealed = true;
      }
      onCompleteRef.current(eventId);
    },
    [clearAllTimers],
  );

  // Exposed to the rendered wheel (3D or fallback): its landing animation finished AND a frame painted.
  // Only the live BALL_LAND is accepted; post-unmount / stale-generation calls are dropped.
  const reportLandingComplete = useCallback(
    (eventId: string) => {
      if (!mountedRef.current) return;
      const head = headRef.current;
      if (!head || head.type !== "BALL_LAND" || head.id !== eventId) return;
      completeEvent(eventId);
    },
    [completeEvent],
  );

  // Publish the reporter in a COMMIT effect (not during render) so Strict Mode mount→cleanup→mount
  // re-publishes it, and only null it on unmount if it is still OUR function (a newer instance may have
  // already replaced it). This makes any reporter the parent saved before unmount a guaranteed no-op.
  useEffect(() => {
    mountedRef.current = true;
    if (landingReporterRef) landingReporterRef.current = reportLandingComplete;
    return () => {
      mountedRef.current = false;
      clearAllTimers();
      playingRef.current = null;
      scheduledRef.current = null;
      headRef.current = null;
      if (landingReporterRef && landingReporterRef.current === reportLandingComplete) {
        landingReporterRef.current = null;
      }
    };
  }, [reportLandingComplete, landingReporterRef, clearAllTimers]);

  useEffect(() => {
    const head = events[0] ?? null;

    if (!head) {
      if (playingRef.current !== null) {
        clearAllTimers();
        playingRef.current = null;
        scheduledRef.current = null;
        headRef.current = null;
        accRef.current.focus = "table"; // idle → back to the table view
        setView(snapshot(accRef.current, null));
      }
      return;
    }

    if (completedRef.current === head.id) return; // already fired — wait for the queue to drop it
    if (playingRef.current === head.id && scheduledRef.current === head.id) return; // alive — leave it

    clearAllTimers();
    playingRef.current = head.id;
    headRef.current = head;

    const acc = accRef.current;
    const effMode = effectiveAnimationMode(mode, reducedMotion);

    switch (head.type) {
      case "NO_MORE_BETS":
        resetForNewSpin(acc);
        break;
      case "BALL_LAND":
        acc.landedNumber = head.result.number; // angle only; resultRevealed stays false until ack
        acc.landingStartedAtMs = nowMs();
        acc.forceFinalizeLanding = false;
        break;
      case "MARK_WINNER":
        acc.dollyNumber = head.number;
        break;
      case "COLLECT_LOSING":
        head.betIds.forEach((id) => acc.collectedBetIds.add(id));
        break;
      case "PAY_WINNING":
        head.payouts.forEach((p) => acc.paidBetIds.add(p.betId));
        break;
      case "RESULT_BANNER":
        acc.banner = {
          result: head.result,
          totalBet: head.totalBet,
          totalReturned: head.totalReturned,
          profit: head.profit,
        };
        break;
      case "SPIN_START":
        break;
    }

    const plan = focusPlan(head.type, effMode);
    acc.focus = plan.focus;
    setView(snapshot(acc, head));
    playRouletteSound(head.type, mode);

    const ms = durationFor(head, mode, reducedMotion);

    // Cosmetic mid-event camera switch (FULL). Fires before the ack; does not advance the queue.
    if (plan.mid && plan.midAt < 1) {
      focusTimerRef.current = window.setTimeout(() => {
        focusTimerRef.current = null;
        if (!mountedRef.current || playingRef.current !== head.id) return;
        accRef.current.focus = plan.mid!;
        setView(snapshot(accRef.current, head));
      }, Math.max(0, ms * plan.midAt));
    }

    if (head.type === "BALL_LAND") {
      // (1) force-finalize REQUEST — never an ack. Asks the wheel to snap to final + report.
      finalizeTimerRef.current = window.setTimeout(() => {
        finalizeTimerRef.current = null;
        if (!mountedRef.current || playingRef.current !== head.id || completedRef.current === head.id) return;
        accRef.current.forceFinalizeLanding = true;
        setView(snapshot(accRef.current, headRef.current));
      }, ms + LANDING_SAFETY_SLACK_MS);

      // (2) catastrophic escape — only if the wheel NEVER reports. Gated on visible + one painted frame
      // so a hidden tab can never reveal early; reschedules while hidden. Records the anomaly.
      const armEscape = (delay: number) => {
        escapeTimerRef.current = window.setTimeout(function fire() {
          escapeTimerRef.current = null;
          if (!mountedRef.current || playingRef.current !== head.id || completedRef.current === head.id) return;
          if (isHidden()) {
            escapeTimerRef.current = window.setTimeout(fire, LANDING_ESCAPE_RECHECK_MS);
            return;
          }
          escapeRafRef.current = requestPaint(() => {
            escapeRafRef.current = null;
            if (!mountedRef.current || playingRef.current !== head.id || completedRef.current === head.id) return;
            if (typeof console !== "undefined") {
              console.warn("[roulette] BALL_LAND force-acked by the liveness escape — the wheel never reported a landing");
            }
            completeEvent(head.id);
          });
        }, delay);
      };
      armEscape(ms + LANDING_ESCAPE_SLACK_MS);
    } else {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        completeEvent(head.id);
      }, ms);
    }

    scheduledRef.current = head.id;
  }, [events, mode, reducedMotion, completeEvent, clearAllTimers]);

  return view;
}
