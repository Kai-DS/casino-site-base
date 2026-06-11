// games/texasHoldem/components/useHoldemAnimationQueue.ts
// Plays the logic's AnimationEvent queue and — most importantly — calls
// onAnimationEventComplete(id) for every event so the logic can advance (spec §26.2).
//
// Contract reminders this hook is built around:
//  • The logic commits the *final* state (pot, communityCards, holeCards) at the moment it
//    queues an event. So values are read from `game.*`; events only say *when/how* to reveal
//    the transition, and carry the numbers to count up to.
//  • Liveness is sacred: if we never call onAnimationEventComplete, the whole hand freezes.
//    Completion is therefore timer-driven (it does not depend on any component rendering or
//    firing an animationend), with guards so it fires exactly once per event.
//  • reduced motion shortens durations but never drops events (§24.12).
import { useEffect, useRef, useState } from "react";
import type { AnimationEvent, Card, HandCategory, HoldemActionKind } from "../types";
import { durationFor } from "./motion";

export interface ActionLabel {
  action: HoldemActionKind;
  amount?: number;
}

export interface ChipFly {
  seat: number;
  amount: number;
  kind: "toPot" | "toSeat";
  /** Bumped per flight so React replays the CSS animation. */
  key: number;
}

export interface ResultBannerView {
  winners: number[];
  category: HandCategory | "fold";
}

export interface HoldemAnimationView {
  /** The event currently being played (null = idle). */
  activeEvent: AnimationEvent | null;
  /** Community cards whose REVEAL event has COMPLETED (0/3/4/5). Gates the board so the flop
   *  isn't shown face-up before its REVEAL plays (it's in game state earlier). */
  revealedCommunity: number;
  /** Hole cards revealed so far this hand, as `${seatIndex}-${cardIndex}` (deal stagger gate). */
  dealtHoleCards: ReadonlySet<string>;
  /** CPU seats whose hole cards have been flipped face-up at showdown. */
  flippedSeats: ReadonlySet<number>;
  /** Winning best-5 cards to highlight, by seat. */
  highlightBySeat: ReadonlyMap<number, Card[]>;
  /** Most recent action label per seat (persists until the seat acts again / new hand). */
  actionLabelBySeat: ReadonlyMap<number, ActionLabel>;
  /** A chip flight in progress (null otherwise). */
  chipFly: ChipFly | null;
  /** Bumped on each CHIP_TO_POT / POST_BLIND so the pot can pulse. */
  potPulseKey: number;
  /** Seat currently "thinking" (CPU progress ring). */
  thinkingSeat: number | null;
  /** Result banner, set when RESULT_BANNER plays and held through the result phase. */
  banner: ResultBannerView | null;
}

interface Accumulators {
  revealedCommunity: number;
  dealtHoleCards: Set<string>;
  flippedSeats: Set<number>;
  highlightBySeat: Map<number, Card[]>;
  actionLabelBySeat: Map<number, ActionLabel>;
  potPulseKey: number;
  flyKey: number;
  banner: ResultBannerView | null;
}

function freshAccumulators(): Accumulators {
  return {
    revealedCommunity: 0,
    dealtHoleCards: new Set(),
    flippedSeats: new Set(),
    highlightBySeat: new Map(),
    actionLabelBySeat: new Map(),
    potPulseKey: 0,
    flyKey: 0,
    banner: null,
  };
}

/** POST_BLIND is the first event of every hand → clear per-hand transient accumulators. */
function resetForNewHand(acc: Accumulators): void {
  acc.revealedCommunity = 0;
  acc.dealtHoleCards = new Set();
  acc.flippedSeats = new Set();
  acc.highlightBySeat = new Map();
  acc.actionLabelBySeat = new Map();
  acc.banner = null;
}

function snapshot(
  acc: Accumulators,
  activeEvent: AnimationEvent | null,
  chipFly: ChipFly | null,
  thinkingSeat: number | null,
): HoldemAnimationView {
  return {
    activeEvent,
    revealedCommunity: acc.revealedCommunity,
    dealtHoleCards: new Set(acc.dealtHoleCards),
    flippedSeats: new Set(acc.flippedSeats),
    highlightBySeat: new Map(acc.highlightBySeat),
    actionLabelBySeat: new Map(acc.actionLabelBySeat),
    chipFly,
    potPulseKey: acc.potPulseKey,
    thinkingSeat,
    banner: acc.banner,
  };
}

export function useHoldemAnimationQueue(
  events: readonly AnimationEvent[],
  onComplete: (eventId: string) => void,
  reducedMotion: boolean,
): HoldemAnimationView {
  const accRef = useRef<Accumulators>(freshAccumulators());
  const [view, setView] = useState<HoldemAnimationView>(() => snapshot(accRef.current, null, null, null));

  const timerRef = useRef<number | null>(null);
  const playingRef = useRef<string | null>(null);
  const completedRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Clear any pending timer only on unmount (NOT on every deps change, or an in-flight event
  // could lose its completion timer and stall the hand).
  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    const head = events[0] ?? null;

    if (!head) {
      if (playingRef.current !== null) {
        playingRef.current = null;
        // Drop active-only transients; keep accumulators (banner, labels, reveals) visible.
        setView(snapshot(accRef.current, null, null, null));
      }
      return;
    }

    // Already fired for this head — wait for the queue to drop it.
    if (completedRef.current === head.id) return;
    // Already scheduled and the timer is alive — leave it running across incidental re-renders.
    if (playingRef.current === head.id && timerRef.current !== null) return;

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    playingRef.current = head.id;

    const acc = accRef.current;
    let chipFly: ChipFly | null = null;
    let thinkingSeat: number | null = null;

    switch (head.type) {
      case "POST_BLIND":
        resetForNewHand(acc);
        acc.flyKey += 1;
        acc.potPulseKey += 1;
        chipFly = { seat: head.seat, amount: head.amount, kind: "toPot", key: acc.flyKey };
        break;
      case "DEAL_HOLE":
        acc.dealtHoleCards.add(`${head.seat}-${head.cardIndex}`);
        break;
      case "CPU_THINKING":
        thinkingSeat = head.seat;
        break;
      case "PLAYER_ACTION_LABEL":
        acc.actionLabelBySeat.set(head.seat, { action: head.action, amount: head.amount });
        break;
      case "CHIP_TO_POT":
        acc.flyKey += 1;
        acc.potPulseKey += 1;
        chipFly = { seat: head.seat, amount: head.amount, kind: "toPot", key: acc.flyKey };
        break;
      case "FLIP_HOLE":
        acc.flippedSeats.add(head.seat);
        break;
      case "HIGHLIGHT_BEST":
        acc.highlightBySeat.set(head.seat, head.cards);
        break;
      case "AWARD_POT":
        acc.flyKey += 1;
        chipFly = { seat: head.seat, amount: head.amount, kind: "toSeat", key: acc.flyKey };
        break;
      case "RESULT_BANNER":
        acc.banner = { winners: head.winners, category: head.category };
        break;
      // REVEAL_FLOP / REVEAL_TURN / REVEAL_RIVER are derived statelessly by CommunityCards
      // from `activeEvent` + the community cards already present in game state.
    }

    setView(snapshot(acc, head, chipFly, thinkingSeat));

    const ms = durationFor(head, reducedMotion);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      completedRef.current = head.id;
      // The reveal has played — mark these community cards settled (face-up from now on).
      if (head.type === "REVEAL_FLOP") acc.revealedCommunity += 3;
      else if (head.type === "REVEAL_TURN" || head.type === "REVEAL_RIVER") acc.revealedCommunity += 1;
      onCompleteRef.current(head.id);
    }, ms);
  }, [events, reducedMotion]);

  return view;
}
