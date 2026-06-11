// components/roulette/RouletteGame.tsx
// Assembles the roulette table: subscribes to the headless useRoulette hook, plays its AnimationEvent
// queue through useRouletteAnimationQueue, and lays out wheel / table / racetrack / controls. Display
// is reveal-gated (§8): the winning number, history, win/lose styling and banner only appear once the
// queue's resultRevealed flips (BALL_LAND ack). The cinematic overlay recedes the board in FULL mode.
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Rate } from "@/types/casino";
import type { GameEconomy } from "@/games/shared/economy";
import { useRoulette } from "@/games/roulette/useRoulette";
import type { ActionResult, AvailableActions, PositionId, RouletteProviders, SpinSettlement } from "@/games/roulette/types";
import type { CallBetId } from "@/games/roulette/constants/callBets";
import { formatChips } from "@/utils/format";
import { type RouletteAnimationMode, type RouletteVisualFocus } from "./animationMode";
import { durationForType, usePrefersReducedMotion } from "./motion";
import { useRouletteAnimationQueue, type RouletteQueueView } from "./useRouletteAnimationQueue";
import { RouletteWheel } from "./RouletteWheel";
import { RouletteTable } from "./RouletteTable";
import { Racetrack } from "./Racetrack";
import { ChipSelector } from "./ChipSelector";
import { RouletteControls } from "./RouletteControls";
import { ResultBanner } from "./ResultBanner";
import { HistoryStrip } from "./HistoryStrip";
import { reasonText } from "./rouletteLabels";

export interface RouletteGameProps {
  rate: Rate;
  economy: GameEconomy;
  animationEnabled?: boolean;
  providers?: RouletteProviders;
  /** Controlled animation mode (sandbox). When omitted the caller still passes mode/onModeChange. */
  mode: RouletteAnimationMode;
  onModeChange: (mode: RouletteAnimationMode) => void;
  /** Sandbox override for reduced motion (OR-ed with the OS setting). */
  forceReducedMotion?: boolean;
  /** Inspector hook — reports the live queue view + logic snapshot each render (sandbox only). */
  onInspect?: (info: RouletteInspect) => void;
  /** Production unmount-flush wiring: receives the hook's flushPendingSettlement (base spec §2.3). */
  flushRef?: MutableRefObject<(() => void) | null>;
  onExit?: () => void;
  onRequestRescue?: () => void;
}

export interface RouletteInspect {
  view: RouletteQueueView;
  phase: string;
  effectiveReducedMotion: boolean;
  activeDurationMs: number;
  stagedTotal: number;
  cappedCount: number;
  settlement: SpinSettlement | null;
  availableActions: AvailableActions;
}

const WHEEL_FOCUSED: ReadonlySet<RouletteVisualFocus> = new Set([
  "wheelZoomIn",
  "highSpeedSpin",
  "suspenseSpin",
  "rattleDrop",
  "winnerReveal",
]);

export function RouletteGame({
  rate,
  economy,
  animationEnabled = true,
  providers,
  mode,
  onModeChange,
  forceReducedMotion = false,
  onInspect,
  flushRef,
  onExit,
  onRequestRescue,
}: RouletteGameProps) {
  const osReduced = usePrefersReducedMotion();
  const reducedMotion = osReduced || forceReducedMotion;

  const game = useRoulette({ rate, economy, animationEnabled, resultProvider: providers?.resultProvider });
  const view = useRouletteAnimationQueue(game.animationEvents, game.onAnimationEventComplete, mode, reducedMotion);

  // Production unmount flush (§2.3): expose the hook's public flush so the page can call it on
  // unmount. The hook ALSO self-flushes (stateRef-only) on its own unmount as the real backstop;
  // by then settlement is settled, so this call is a safe no-op.
  if (flushRef) flushRef.current = game.flushPendingSettlement;

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const flash = useCallback((result: ActionResult) => {
    if (result.ok) return;
    setToast(reasonText(result.reason) ?? result.message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  const spinMs = durationForType("SPIN_START", mode, reducedMotion);
  const landMs = durationForType("BALL_LAND", mode, reducedMotion);

  // Inspector report (sandbox).
  useEffect(() => {
    if (!onInspect) return;
    const activeDurationMs = view.activeEvent ? durationForType(view.activeEvent.type, mode, reducedMotion) : 0;
    onInspect({
      view,
      phase: game.state.phase,
      effectiveReducedMotion: reducedMotion,
      activeDurationMs,
      stagedTotal: game.state.stagedTotal,
      cappedCount: game.cappedPositionIds.length,
      settlement: game.state.settlement,
      availableActions: game.availableActions,
    });
  }, [onInspect, view, game.state.phase, game.state.stagedTotal, game.cappedPositionIds.length, game.state.settlement, game.availableActions, mode, reducedMotion]);

  const betting = game.state.phase === "betting" && !game.isAnimating;
  const winningNumber = view.resultRevealed ? view.dollyNumber ?? view.landedNumber : null;
  const cinematic = mode === "full" && !reducedMotion && WHEEL_FOCUSED.has(view.visualFocus);

  const place = (id: PositionId) => flash(game.placeChip(id));
  const callBet = (id: CallBetId) => flash(game.placeCallBet(id));
  const neighbors = (center: number, n: number) => flash(game.placeNeighbors(center, n));
  const spin = () => flash(game.spin());

  const chips = economy.chips;

  return (
    <div className="roulette-stage relative flex min-h-0 flex-1 flex-col gap-3 p-3" data-cinematic={cinematic}>
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg text-[var(--gold-2)]">Roulette</span>
          <span className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] uppercase text-white/60">{rate.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wide text-white/40">Chips</div>
            <button
              type="button"
              onClick={onRequestRescue}
              className="font-display text-base tabular-nums text-white hover:text-[var(--gold-2)]"
            >
              {formatChips(chips)}
            </button>
          </div>
          {onExit && (
            <button type="button" onClick={onExit} className="focus-ring rounded-md border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10">
              Exit
            </button>
          )}
        </div>
      </div>

      {/* board */}
      <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        {/* left: wheel + history (the wheel is the star — never recedes) */}
        <div className="flex flex-col gap-3">
          <div className="roulette-wheel-slot">
            <div className={`roulette-wheel-holder ${cinematic ? "is-cinematic" : ""}`}>
              <RouletteWheel
                activeEventType={view.activeEvent?.type ?? null}
                landedNumber={view.landedNumber}
                resultRevealed={view.resultRevealed}
                dollyNumber={view.dollyNumber}
                visualFocus={view.visualFocus}
                mode={reducedMotion ? "reduced" : mode}
                spinMs={spinMs}
                landMs={landMs}
              />
            </div>
          </div>
          <HistoryStrip history={game.state.history} />
        </div>

        {/* center: betting table */}
        <div className={`flex items-start justify-center ${cinematic ? "roulette-recede" : ""}`}>
          <div className="w-full max-w-[440px]">
            <RouletteTable
              positionTotals={game.positionTotals}
              cappedPositionIds={game.cappedPositionIds}
              interactive={betting}
              winningNumber={winningNumber}
              onPlace={place}
            />
          </div>
        </div>

        {/* right: racetrack + chips + controls */}
        <div className={`flex flex-col gap-3 ${cinematic ? "roulette-recede" : ""}`}>
          <Racetrack
            selectedChip={game.selectedChip}
            neighborRange={game.config.neighborRange}
            interactive={betting}
            onCallBet={callBet}
            onNeighbors={neighbors}
          />
          <ChipSelector denoms={game.config.chipDenoms} selected={game.selectedChip} disabled={!betting} onSelect={game.selectChip} />
          <RouletteControls
            availableActions={game.availableActions}
            stagedTotal={game.state.stagedTotal}
            mode={mode}
            reducedActive={reducedMotion}
            onSpin={spin}
            onUndo={() => flash(game.undo())}
            onClear={() => flash(game.clearBets())}
            onRebet={() => flash(game.rebet())}
            onNewBets={() => flash(game.newBets())}
            onModeChange={onModeChange}
          />
        </div>
      </div>

      {/* NO MORE BETS flash */}
      {view.visualFocus === "closingBets" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-40 flex justify-center">
          <span className="rounded-full border border-[var(--gold-2)]/50 bg-black/70 px-6 py-2 font-display text-xl uppercase tracking-widest text-[var(--gold-2)]">
            No more bets
          </span>
        </div>
      )}

      {/* cinematic backdrop */}
      <div className="roulette-cinematic-backdrop" data-on={cinematic} />

      {/* result banner overlay */}
      {view.banner && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-4">
          <ResultBanner
            banner={view.banner}
            availableActions={game.availableActions}
            onRebet={() => flash(game.rebet())}
            onNewBets={() => flash(game.newBets())}
          />
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center">
          <span className="rounded-lg border border-red-400/40 bg-black/80 px-4 py-2 text-sm text-red-200">{toast}</span>
        </div>
      )}
    </div>
  );
}
