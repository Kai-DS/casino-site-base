import { useCallback, useEffect, useRef, useState } from "react";
import type { Rate } from "@/types/casino";
import type { RNG } from "@/types/card";
import type { GameEconomy } from "@/games/shared/economy";
import { useVideoPoker, type ActionResult, type VideoPokerPhase } from "./useVideoPoker";
import type { DeckProvider } from "../logic/deckProvider";
import { CLASSIC_ROYAL_BONUS } from "../adapter";
import { PAYOUT_LABELS, type PayoutResult } from "../logic/payout";
import { bestHold } from "../logic/strategy";
import { sound } from "../sound";
import { VideoPokerStatusPanel } from "./VideoPokerStatusPanel";
import { VideoPokerPaytable } from "./VideoPokerPaytable";
import { VideoPokerTable } from "./VideoPokerTable";
import { VideoPokerControls } from "./VideoPokerControls";
import { VideoPokerResultBanner } from "./VideoPokerResultBanner";
import { VideoPokerWinFx, type WinFxTier } from "./VideoPokerWinFx";

function fxTier(category: PayoutResult["category"]): WinFxTier | null {
  if (category === "royal_flush") return "royal";
  if (category === "straight_flush" || category === "four_of_a_kind") return "big";
  return null;
}

export type VideoPokerSessionSnapshot = {
  tableStack: number;
  canRebuy: boolean;
  rebuy: (newTableStack: number) => ActionResult;
};

export type VideoPokerDebugSnapshot = {
  phase: VideoPokerPhase;
  coinCount: number;
  currentBet: number;
  lockedBet: number | null;
  tableStack: number;
  isAnimating: boolean;
  handId: number;
  lastCategory: string | null;
  lastPayout: number | null;
  winningCardIndexes: number[];
};

type VideoPokerGameProps = {
  rate: Rate;
  economy: GameEconomy;
  onInsufficient: () => void;
  initialTableStack?: number;
  rng?: RNG;
  deckProvider?: DeckProvider;
  onSessionChange?: (session: VideoPokerSessionSnapshot) => void;
  /** Sandbox-only: emits internal state for the debug panel (spec §33.1). */
  onDebug?: (snapshot: VideoPokerDebugSnapshot) => void;
};

/** Video Poker cabinet: a glowing LCD screen (meter + paytable + cards + result) over physical controls. */
export function VideoPokerGame({
  rate,
  economy,
  onInsufficient,
  initialTableStack,
  rng,
  deckProvider,
  onSessionChange,
  onDebug,
}: VideoPokerGameProps) {
  const vp = useVideoPoker(rate, economy, onInsufficient, { initialTableStack, rng, deckProvider });

  const [uiAnimating, setUiAnimating] = useState(false);
  const [fx, setFx] = useState<{ tier: WinFxTier; label: string; amount: number } | null>(null);
  const lastFxRef = useRef<PayoutResult | null>(null);

  // Optimal-hold advisor (Phase 5): non-destructive suggestion highlight.
  const [suggested, setSuggested] = useState<number[]>([]);
  const [computing, setComputing] = useState(false);

  const [muted, setMuted] = useState(sound.isMuted());
  useEffect(() => sound.subscribe(() => setMuted(sound.isMuted())), []);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
  }, []);

  const guard = useCallback(
    (result: ActionResult, okSound?: () => void) => {
      if (!result.ok) flash(result.message);
      else okSound?.();
    },
    [flash],
  );

  useEffect(() => {
    onSessionChange?.({ tableStack: vp.tableStack, canRebuy: vp.canRebuy, rebuy: vp.rebuy });
  }, [onSessionChange, vp.canRebuy, vp.rebuy, vp.tableStack]);

  useEffect(() => {
    onDebug?.({
      phase: vp.phase,
      coinCount: vp.coins,
      currentBet: vp.currentBet,
      lockedBet: vp.lockedBet,
      tableStack: vp.tableStack,
      isAnimating: uiAnimating,
      handId: vp.handId,
      lastCategory: vp.lastResult?.category ?? null,
      lastPayout: vp.lastResult?.payout ?? null,
      winningCardIndexes: vp.winningCardIndexes,
    });
  }, [
    onDebug,
    vp.phase,
    vp.coins,
    vp.currentBet,
    vp.lockedBet,
    vp.tableStack,
    uiAnimating,
    vp.handId,
    vp.lastResult,
    vp.winningCardIndexes,
  ]);

  const showResult = vp.phase === "result" && !uiAnimating ? vp.lastResult : null;

  // Fire the celebration overlay once when a big/royal result reveals.
  useEffect(() => {
    if (!showResult || lastFxRef.current === showResult) return;
    lastFxRef.current = showResult;
    const tier = fxTier(showResult.category);
    if (tier) setFx({ tier, label: PAYOUT_LABELS[showResult.category], amount: showResult.payout });
    if (tier === "royal") sound.royal();
    else if (tier === "big") sound.bigWin();
    else if (showResult.payout > 0) sound.win();
  }, [showResult]);

  // Clear the advisor suggestion whenever a new hand is dealt or we leave the draw phase.
  useEffect(() => {
    setSuggested([]);
  }, [vp.handId, vp.phase]);

  const onHint = useCallback(() => {
    if (vp.phase !== "draw" || computing) return;
    const cards = vp.cards;
    if (cards.length !== 5) return;
    setComputing(true);
    // Defer so the "…" state paints before the (heavy) exact-EV search runs.
    window.setTimeout(() => {
      try {
        const { mask } = bestHold(cards, vp.coins, CLASSIC_ROYAL_BONUS);
        setSuggested(mask.map((hold, i) => (hold ? i : -1)).filter((i) => i >= 0));
      } finally {
        setComputing(false);
      }
    }, 30);
  }, [vp.phase, vp.cards, vp.coins, computing]);

  // Keyboard: 1–5 Hold, Space/Enter DEAL/DRAW, M MAX BET (spec §32.3).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (k >= "1" && k <= "5") {
        if (vp.phase === "draw") {
          e.preventDefault();
          guard(vp.toggleHold(Number(k) - 1), sound.hold);
        }
        return;
      }
      if (k === " " || k === "Enter") {
        if (tag === "button") return; // let the focused button handle it natively
        e.preventDefault();
        if (vp.phase === "draw") guard(vp.draw(), sound.draw);
        else guard(vp.deal(), sound.deal);
        return;
      }
      if (k === "m" || k === "M") guard(vp.maxBet());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vp, guard]);

  return (
    <div className="vp-bezel relative mx-auto flex h-full w-full max-w-5xl flex-col gap-2 rounded-[1.75rem] p-2 sm:p-3">
      {/* Mute toggle */}
      <button
        type="button"
        onClick={() => sound.toggleMute()}
        aria-label={muted ? "Unmute" : "Mute"}
        className="focus-ring absolute right-3 top-3 z-30 rounded-full border border-white/15 bg-black/50 px-2 py-1 text-sm text-white/70 hover:bg-white/10"
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* LCD screen */}
      <div className="vp-screen flex min-h-0 flex-1 flex-col gap-2 rounded-2xl p-2 sm:p-3">
        <VideoPokerStatusPanel
          chips={economy.chips}
          tableStack={vp.tableStack}
          bet={vp.currentBet}
          coins={vp.coins}
          lastWin={showResult?.payout ?? null}
        />

        <VideoPokerPaytable
          coins={vp.coins}
          classicRoyalBonus={CLASSIC_ROYAL_BONUS}
          activeCategory={showResult?.category ?? null}
        />

        {/* Cards fill the remaining screen height */}
        <div className="min-h-0 flex-1">
          <VideoPokerTable
            hand={vp.hand}
            held={vp.held}
            phase={vp.phase}
            handId={vp.handId}
            winningCardIndexes={vp.winningCardIndexes}
            suggestedIndexes={suggested}
            onAnimatingChange={setUiAnimating}
            onToggleHold={(i) => guard(vp.toggleHold(i), sound.hold)}
          />
        </div>

        <VideoPokerResultBanner result={showResult} phase={vp.phase} />
      </div>

      {/* Physical controls below the screen */}
      <div className="shrink-0">
        <VideoPokerControls
          coins={vp.coins}
          canChangeBet={vp.canChangeBet && !uiAnimating}
          canDeal={vp.canDeal && !uiAnimating}
          canDraw={vp.canDraw && !uiAnimating}
          canHint={vp.phase === "draw" && !uiAnimating && !computing}
          computing={computing}
          phase={vp.phase}
          onSetCoins={(n) => guard(vp.setCoins(n))}
          onMaxBet={() => guard(vp.maxBet())}
          onDeal={() => guard(vp.deal(), sound.deal)}
          onDraw={() => guard(vp.draw(), sound.draw)}
          onHint={onHint}
        />
      </div>

      {fx && (
        <VideoPokerWinFx tier={fx.tier} label={fx.label} amount={fx.amount} onDone={() => setFx(null)} />
      )}

      {toast && (
        <div className="animate-fadeIn pointer-events-none absolute inset-x-0 bottom-20 z-30 mx-auto w-fit rounded-full border border-red-500/40 bg-black/85 px-4 py-2 text-sm text-red-200">
          {toast}
        </div>
      )}
    </div>
  );
}
