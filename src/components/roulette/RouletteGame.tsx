// components/roulette/RouletteGame.tsx
// Assembles the perspective roulette table (Perspective Redesign §3): a wood-framed felt surface under
// a single tilt holds the wheel (left) + landscape board (right); the control rail + overlays sit
// OUTSIDE the tilt (§3.2.2). The cinematic FULL mode zooms `.wheel-stage` and recedes the board.
// Display stays reveal-gated (§8): winning number / history / win-lose / banner appear only after the
// queue's resultRevealed flips. The logic, contract and event order are never touched.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type MutableRefObject } from "react";
import type { Rate } from "@/types/casino";
import type { GameEconomy } from "@/games/shared/economy";
import { useRoulette } from "@/games/roulette/useRoulette";
import type { ActionResult, AvailableActions, PositionId, RouletteProviders, SpinResult, SpinSettlement } from "@/games/roulette/types";
import type { CallBetId } from "@/games/roulette/constants/callBets";
import { colorOf } from "@/games/roulette/constants/wheel";
import { formatChips } from "@/utils/format";
import { type RouletteAnimationMode, type RouletteVisualFocus, effectiveAnimationMode } from "./animationMode";
import { durationForType, usePrefersReducedMotion } from "./motion";
import { useRouletteAnimationQueue, type RouletteQueueView } from "./useRouletteAnimationQueue";
import { RouletteWheel } from "./RouletteWheel";
import { RouletteTable } from "./RouletteTable";
import { Racetrack } from "./Racetrack";
import { ChipSelector } from "./ChipSelector";
import { RouletteControls } from "./RouletteControls";
import { ResultBanner } from "./ResultBanner";
import { HistoryStrip } from "./HistoryStrip";
import { reasonText, resultMeta, POCKET_FILL } from "./rouletteLabels";

export interface RouletteGameProps {
  rate: Rate;
  economy: GameEconomy;
  animationEnabled?: boolean;
  providers?: RouletteProviders;
  mode: RouletteAnimationMode;
  onModeChange: (mode: RouletteAnimationMode) => void;
  forceReducedMotion?: boolean;
  onInspect?: (info: RouletteInspect) => void;
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
  placedPositionIds: readonly PositionId[];
}

const WHEEL_FOCUSED: ReadonlySet<RouletteVisualFocus> = new Set(["wheelZoomIn", "highSpeedSpin", "suspenseSpin", "rattleDrop", "winnerReveal"]);

function useIsMobile(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia("(max-width: 767px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(max-width: 767px)").matches : false),
    () => false,
  );
}

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
  const isMobile = useIsMobile();

  const game = useRoulette({ rate, economy, animationEnabled, resultProvider: providers?.resultProvider });
  // The wheel reports its real landing completion through this ref (§17); the queue acks BALL_LAND on it.
  const landingReporterRef = useRef<((eventId: string) => void) | null>(null);
  const view = useRouletteAnimationQueue(game.animationEvents, game.onAnimationEventComplete, mode, reducedMotion, landingReporterRef);
  const onLandingComplete = useCallback((eventId: string) => landingReporterRef.current?.(eventId), []);

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

  // The banner appears at RESULT_BANNER and the queue only clears it at the next spin's NO_MORE_BETS.
  // Pressing REBET or NEW BETS should dismiss it immediately so the board is usable again; it re-shows
  // when the next spin produces a fresh banner.
  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    if (!view.banner) setBannerDismissed(false);
  }, [view.banner]);

  const effMode = effectiveAnimationMode(mode, reducedMotion);
  const spinMs = durationForType("SPIN_START", mode, reducedMotion);
  const landMs = durationForType("BALL_LAND", mode, reducedMotion);

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
      placedPositionIds: Object.keys(game.positionTotals).filter((id) => (game.positionTotals[id] ?? 0) > 0),
    });
  }, [onInspect, view, game.state.phase, game.state.stagedTotal, game.cappedPositionIds.length, game.state.settlement, game.availableActions, game.positionTotals, mode, reducedMotion]);

  const betting = game.state.phase === "betting" && !game.isAnimating;
  const winningNumber = view.resultRevealed ? view.dollyNumber ?? view.landedNumber : null;
  const cinematic = effMode === "full" && WHEEL_FOCUSED.has(view.visualFocus);
  const landEventId = view.activeEvent?.type === "BALL_LAND" ? view.activeEvent.id : null;

  const place = (id: PositionId) => flash(game.placeChip(id));
  const callBet = (id: CallBetId) => flash(game.placeCallBet(id));
  const doRebet = () => { setBannerDismissed(true); flash(game.rebet()); };
  const doNewBets = () => { setBannerDismissed(true); flash(game.newBets()); };
  const neighbors = (center: number, n: number) => flash(game.placeNeighbors(center, n));

  const chips = economy.chips;

  return (
    <div className="roulette-theme roulette-page-shell relative flex min-h-0 flex-1 flex-col text-[var(--rl-ink)]">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-1.5">
        <div className="flex items-center gap-3">
          <span className="font-display text-base tracking-wide text-[var(--rl-gold-hi)]">ROULETTE</span>
          <span className="rounded border border-[var(--rl-gold)]/40 px-2 py-0.5 text-[10px] uppercase text-[var(--rl-ink-dim)]">{rate.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onRequestRescue} className="text-right">
            <div className="text-[9px] uppercase tracking-wide text-[var(--rl-ink-dim)]">Chips</div>
            <div className="font-display text-base tabular-nums text-[var(--rl-gold-hi)]">{formatChips(chips)}</div>
          </button>
          {onExit && (
            <button type="button" onClick={onExit} className="focus-ring rounded border border-[var(--rl-gold)]/40 px-2 py-1 text-xs text-[var(--rl-ink-dim)] hover:text-[var(--rl-ink)]">
              Exit
            </button>
          )}
        </div>
      </div>

      {/* table area (tilt) */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        <div className="table-surface w-full" style={{ maxWidth: 1232, maxHeight: isMobile ? undefined : 584 }}>
          <div className="flex h-full flex-col gap-4 lg:flex-row lg:gap-5">
            {/* left: wheel + history */}
            <div className="flex shrink-0 flex-col items-center gap-2 lg:w-[368px]">
              <div className="wheel-stage" style={{ width: isMobile ? 240 : 336, height: isMobile ? 240 : 336 }}>
                <RouletteWheel
                  activeEventType={view.activeEvent?.type ?? null}
                  landedNumber={view.landedNumber}
                  resultRevealed={view.resultRevealed}
                  dollyNumber={view.dollyNumber}
                  mode={effMode}
                  spinMs={spinMs}
                  landMs={landMs}
                  closeUp={cinematic}
                  reducedMotion={reducedMotion}
                  landEventId={landEventId}
                  onLandingComplete={onLandingComplete}
                  landingStartedAtMs={view.landingStartedAtMs}
                  forceFinalizeLanding={view.forceFinalizeLanding}
                />
              </div>
              <HistoryStrip history={game.state.history} />
            </div>

            {/* right: aux row + board */}
            <div className="board-recede flex min-w-0 flex-1 flex-col gap-3" data-recede={cinematic}>
              <div className="flex min-h-0 shrink-0 gap-3" style={{ height: isMobile ? undefined : 140 }}>
                <div className="min-w-0 flex-1">
                  <Racetrack selectedChip={game.selectedChip} neighborRange={game.config.neighborRange} interactive={betting} onCallBet={callBet} onNeighbors={neighbors} />
                </div>
                <AuxPanel history={game.state.history} />
              </div>
              <div className="min-h-0 flex-1" style={{ height: isMobile ? undefined : 396 }}>
                <RouletteTable
                  positionTotals={game.positionTotals}
                  cappedPositionIds={game.cappedPositionIds}
                  interactive={betting}
                  winningNumber={winningNumber}
                  orientation={isMobile ? "portrait" : "landscape"}
                  onPlace={place}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* control rail (outside tilt) */}
      <div className="control-rail shrink-0 px-3 py-2" style={{ minHeight: isMobile ? undefined : 120 }}>
        <RouletteControls
          availableActions={game.availableActions}
          stagedTotal={game.state.stagedTotal}
          mode={mode}
          onSpin={() => flash(game.spin())}
          onUndo={() => flash(game.undo())}
          onClear={() => flash(game.clearBets())}
          onRebet={doRebet}
          onNewBets={doNewBets}
          onModeChange={onModeChange}
          chipSelector={<ChipSelector denoms={game.config.chipDenoms} selected={game.selectedChip} disabled={!betting} onSelect={game.selectChip} />}
        />
      </div>

      {/* overlay layer (outside tilt) */}
      <div className="overlay-layer pointer-events-none absolute inset-0 z-40">
        {view.visualFocus === "closingBets" && (
          <div className="absolute inset-x-0 top-[18%] flex justify-center">
            <span className="rounded-full border border-[var(--rl-gold)]/50 bg-black/75 px-6 py-2 font-display text-lg uppercase tracking-[0.3em] text-[var(--rl-gold-hi)]">No more bets</span>
          </div>
        )}
        {view.banner && !bannerDismissed && (
          <div className="absolute inset-0 flex items-start justify-center pt-[8%]">
            <ResultBanner banner={view.banner} availableActions={game.availableActions} onRebet={doRebet} onNewBets={doNewBets} />
          </div>
        )}
        {toast && (
          <div className="absolute inset-x-0 bottom-[150px] flex justify-center">
            <span className="rounded-lg border border-red-400/40 bg-black/80 px-4 py-2 text-sm text-red-200">{toast}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LAST RESULT + TRENDS (honest "LAST 12" — §8) ─────────────────────────────
function AuxPanel({ history }: { history: readonly SpinResult[] }) {
  const last = history[0] ?? null;
  const reds = history.filter((r) => r.color === "red").length;
  const blacks = history.filter((r) => r.color === "black").length;
  const greens = history.filter((r) => r.color === "green").length;
  const total = Math.max(1, history.length);
  const counts = new Map<number, number>();
  history.forEach((r) => counts.set(r.number, (counts.get(r.number) ?? 0) + 1));
  const hot = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
  const meta = last ? resultMeta(last) : [];

  return (
    <div className="hidden w-[228px] shrink-0 flex-col gap-1.5 rounded-lg border border-[var(--rl-gold)]/25 bg-black/30 p-2 text-[10px] lg:flex">
      <div className="flex items-center gap-2">
        <span className="uppercase tracking-wide text-[var(--rl-ink-dim)]">Last</span>
        {last ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--rl-gold)] text-[12px] font-bold text-white" style={{ background: POCKET_FILL[last.color] }}>
            {last.number}
          </span>
        ) : (
          <span className="text-[var(--rl-ink-dim)]">—</span>
        )}
        <span className="flex flex-wrap gap-x-1 text-[var(--rl-ink-dim)]">
          {last ? meta.slice(0, 4).map((m) => <span key={m.label}>{m.value}</span>) : "—"}
        </span>
      </div>
      <div>
        <div className="mb-0.5 uppercase tracking-wide text-[var(--rl-ink-dim)]">Last 12</div>
        <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
          <span style={{ width: `${(reds / total) * 100}%`, background: "var(--rl-red-hi)" }} />
          <span style={{ width: `${(blacks / total) * 100}%`, background: "var(--rl-black-hi)" }} />
          <span style={{ width: `${(greens / total) * 100}%`, background: "var(--rl-zero-hi)" }} />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="uppercase tracking-wide text-[var(--rl-ink-dim)]">Hot</span>
        {hot.length ? hot.map((n) => (
          <span key={n} className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: POCKET_FILL[colorOf(n)] }}>{n}</span>
        )) : <span className="text-[var(--rl-ink-dim)]">—</span>}
      </div>
    </div>
  );
}
