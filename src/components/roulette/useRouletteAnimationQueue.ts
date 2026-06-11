// components/roulette/useRouletteAnimationQueue.ts
// Plays the logic's AnimationEvent queue for roulette and — most importantly — calls
// onAnimationEventComplete(id) for every event so the spin can advance (base spec §6.2, addendum §7.4).
//
// Invariants this hook guards:
//  • Liveness is timer-driven. durationFor(event, mode, reducedMotion) → setTimeout → ack. It NEVER
//    waits on a CSS animationend, and a 3-point ref guard keeps an in-flight event's timer alive
//    across incidental re-renders (so a mode toggle mid-spin can't stall the hand).
//  • ★ Result-hiding gate (`resultRevealed`, addendum §8): the logic has `settlement` ready at spin()
//    time, but the UI must reveal nothing until BALL_LAND's timer completes. We flip resultRevealed
//    true ONLY in BALL_LAND's completion callback; before that the only thing readable is
//    BALL_LAND.result.number — and only for the ball's landing angle.
//  • visualFocus (addendum §5/§6) is the UI "camera", layered on the event stream; FULL adds a
//    cosmetic mid-event focus switch (does not ack).
//  • Accumulators reset on NO_MORE_BETS (each spin's first event), mirroring Hold'em's POST_BLIND.
import { useEffect, useRef, useState } from "react";
import type { AnimationEvent, SpinResult } from "@/games/roulette/types";
import { type RouletteAnimationMode, type RouletteVisualFocus, effectiveAnimationMode } from "./animationMode";
import { durationFor, focusPlan } from "./motion";
import { playRouletteSound } from "./rouletteSound";

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
  /** False until BALL_LAND's timer completes — gates ALL settlement-derived display (§8). */
  resultRevealed: boolean;
  /** Winning number from BALL_LAND payload. Usable pre-reveal ONLY for the ball landing angle. */
  landedNumber: number | null;
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
): RouletteQueueView {
  const accRef = useRef<Accumulators>(freshAccumulators());
  const [view, setView] = useState<RouletteQueueView>(() => snapshot(accRef.current, null));

  const timerRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const playingRef = useRef<string | null>(null);
  const completedRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Clear timers only on unmount (not per deps change, or an in-flight event loses its ack timer).
  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
  }, []);

  useEffect(() => {
    const head = events[0] ?? null;

    if (!head) {
      if (playingRef.current !== null) {
        playingRef.current = null;
        accRef.current.focus = "table"; // idle → back to the table view
        setView(snapshot(accRef.current, null));
      }
      return;
    }

    if (completedRef.current === head.id) return; // already fired — wait for the queue to drop it
    if (playingRef.current === head.id && timerRef.current !== null) return; // alive — leave it

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    playingRef.current = head.id;

    const acc = accRef.current;
    const effMode = effectiveAnimationMode(mode, reducedMotion);

    switch (head.type) {
      case "NO_MORE_BETS":
        resetForNewSpin(acc);
        break;
      case "BALL_LAND":
        acc.landedNumber = head.result.number; // angle only; resultRevealed stays false until ack
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

    // Cosmetic mid-event camera switch (FULL). Fires before the ack timer; does not advance the queue.
    if (plan.mid && plan.midAt < 1) {
      focusTimerRef.current = window.setTimeout(() => {
        focusTimerRef.current = null;
        if (playingRef.current !== head.id) return;
        accRef.current.focus = plan.mid!;
        setView(snapshot(accRef.current, head));
      }, Math.max(0, ms * plan.midAt));
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      completedRef.current = head.id;
      // ★ The ball has landed — only now may the result be revealed (§8.3).
      if (head.type === "BALL_LAND") acc.resultRevealed = true;
      onCompleteRef.current(head.id);
    }, ms);
  }, [events, mode, reducedMotion]);

  return view;
}
