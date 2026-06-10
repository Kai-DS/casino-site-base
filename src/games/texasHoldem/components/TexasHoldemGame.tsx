// games/texasHoldem/components/TexasHoldemGame.tsx
// Top-level Texas Hold'em screen. It subscribes to the real useTexasHoldem hook, plays the
// animation-event queue (calling onAnimationEventComplete so the logic advances — spec §26.2),
// and assembles the felt / seats / community / pot / controls / log / result.
//
// Boundaries it respects (spec §21.3 / §26.3): state is read-only here; button enablement and
// disabled reasons come from availableActions; winner / amount / category come from lastResult
// and the events. Nothing about the game is recomputed in the UI.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameEconomy } from "@/games/shared/economy";
import { Button } from "@/components/common/Button";
import { BuyInControl } from "@/components/casino/BuyInControl";
import { ChipStack } from "@/components/casino/ChipStack";
import { clampBuyIn } from "@/constants/rates";
import { formatChips } from "@/utils/format";
import { useTexasHoldem } from "../useTexasHoldem";
import type { AnimationEvent, HoldemDeckProvider, HoldemPhase, HoldemSeat, RNG, Rate } from "../types";
import { usePrefersReducedMotion } from "./motion";
import { useHoldemAnimationQueue } from "./useHoldemAnimationQueue";
import { actionLabel } from "./holdemLabels";
import { seatSlot, FELT_INSET } from "./tableLayout";
import { PokerTable } from "./PokerTable";
import { HoldemSeat as Seat } from "./HoldemSeat";
import { CommunityCards } from "./CommunityCards";
import { PotDisplay } from "./PotDisplay";
import { HoldemControls } from "./HoldemControls";
import { ActionLog, type ActionLogEntry } from "./ActionLog";
import { ResultBanner } from "./ResultBanner";
import { RebuyModal } from "./RebuyModal";

type TexasHoldemGameProps = {
  rate: Rate;
  economy: GameEconomy;
  /** Defaults to true — the visual UI is built around the event queue. */
  animationEnabled?: boolean;
  rng?: RNG;
  deckProvider?: HoldemDeckProvider;
  /** Production: auto-take a seat with this stack (the amount chosen in the lobby), skipping
   *  the in-game buy-in overlay. Omit (sandbox) to buy in manually. */
  initialBuyIn?: number;
  /** Production: render a "← Lobby" affordance that leaves the table. */
  onExit?: () => void;
  /** Production: invoked when the player can't afford the table (opens the rescue flow). */
  onRequestRescue?: () => void;
};

const BETTING_PHASES: ReadonlySet<HoldemPhase> = new Set(["preflop", "flop", "turn", "river"]);
const DEALING_PHASES: ReadonlySet<HoldemPhase> = new Set(["postingBlinds", "dealingHoleCards"]);

function seatName(seats: readonly HoldemSeat[], seatIndex: number): string {
  return seats.find((s) => s.seatIndex === seatIndex)?.name ?? `Seat ${seatIndex}`;
}

/** Turn a played event into an action-log line (display only). */
function logEntryFor(event: AnimationEvent, seats: readonly HoldemSeat[]): ActionLogEntry | null {
  switch (event.type) {
    case "POST_BLIND":
      return { id: event.id, text: `${seatName(seats, event.seat)} posts ${formatChips(event.amount)}` };
    case "PLAYER_ACTION_LABEL":
      return {
        id: event.id,
        text: `${seatName(seats, event.seat)} ${actionLabel(event.action, event.amount)}`,
        tone: "accent",
      };
    case "REVEAL_FLOP":
      return { id: event.id, text: "— Flop —" };
    case "REVEAL_TURN":
      return { id: event.id, text: "— Turn —" };
    case "REVEAL_RIVER":
      return { id: event.id, text: "— River —" };
    case "AWARD_POT":
      return {
        id: event.id,
        text: `${seatName(seats, event.seat)} wins ${formatChips(event.amount)}${event.isSplit ? " (split)" : ""}`,
        tone: "win",
      };
    default:
      return null;
  }
}

export function TexasHoldemGame({
  rate,
  economy,
  animationEnabled = true,
  rng,
  deckProvider,
  initialBuyIn,
  onExit,
  onRequestRescue,
}: TexasHoldemGameProps) {
  const game = useTexasHoldem({ rate, economy, animationEnabled, rng, deckProvider });
  const reducedMotion = usePrefersReducedMotion();
  const view = useHoldemAnimationQueue(game.animationEvents, game.onAnimationEventComplete, reducedMotion);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  const act = useCallback(
    (fn: () => { ok: boolean; message?: string }) => {
      const result = fn();
      if (!result.ok && result.message) flash(result.message);
    },
    [flash],
  );

  // ── Action log: append as events play; clear at the start of each hand ──────
  const [log, setLog] = useState<ActionLogEntry[]>([]);
  const lastLoggedRef = useRef<string | null>(null);
  const prevPhaseRef = useRef<HoldemPhase>(game.phase);
  useEffect(() => {
    if (game.phase === "postingBlinds" && prevPhaseRef.current !== "postingBlinds") {
      setLog([]);
      lastLoggedRef.current = null;
    }
    prevPhaseRef.current = game.phase;
  }, [game.phase]);
  useEffect(() => {
    const event = view.activeEvent;
    if (!event || lastLoggedRef.current === event.id) return;
    lastLoggedRef.current = event.id;
    const entry = logEntryFor(event, game.seats);
    if (entry) setLog((prev) => [...prev, entry].slice(-40));
  }, [view.activeEvent, game.seats]);

  // ── Buy-in / re-buy ────────────────────────────────────────────────────────
  const [buyInAmount, setBuyInAmount] = useState(() => clampBuyIn(rate, rate.buyInMin, economy.chips));
  useEffect(() => {
    setBuyInAmount((v) => clampBuyIn(rate, v || rate.buyInMin, economy.chips));
  }, [rate, economy.chips]);
  const [rebuyOpen, setRebuyOpen] = useState(false);

  // Production: auto-take a seat with the lobby-chosen stack, skipping the manual buy-in overlay.
  const seatedRef = useRef(false);
  useEffect(() => {
    if (initialBuyIn == null || seatedRef.current) return;
    if (game.phase !== "buyIn" && game.phase !== "unseated") return;
    if (economy.chips < rate.buyInMin) return;
    seatedRef.current = true;
    game.buyIn(clampBuyIn(rate, initialBuyIn, economy.chips));
  }, [initialBuyIn, game.phase, game.buyIn, rate, economy.chips]);

  const player = useMemo(
    () => game.seats.find((s) => s.seatIndex === game.playerSeatIndex) ?? null,
    [game.seats, game.playerSeatIndex],
  );

  const isBetting = BETTING_PHASES.has(game.phase);
  const isDealing = DEALING_PHASES.has(game.phase);
  const communityHighlight = useMemo(() => {
    const cards = [] as NonNullable<ReturnType<typeof view.highlightBySeat.get>>;
    view.highlightBySeat.forEach((cs) => cards.push(...cs));
    return cards;
  }, [view.highlightBySeat]);

  return (
    <div className="holdem-backdrop relative flex min-h-full w-full flex-col gap-3 rounded-2xl p-3 sm:p-4">
      {/* Top bar: chips / table stack / rate / blinds (spec §27) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
        <div className="flex items-center gap-3 text-sm">
          {onExit && (
            <Button size="sm" variant="ghost" onClick={onExit}>
              ← Lobby
            </Button>
          )}
          <span className="font-display text-base text-[var(--gold-2)]">Texas Hold'em</span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs uppercase tracking-wide text-white/70">{rate.label}</span>
          <span className="hidden text-xs text-[var(--text-mid)] sm:inline">
            Blinds {formatChips(game.smallBlind)}/{formatChips(game.bigBlind)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[var(--text-mid)]">
            Chips <span className="font-semibold tabular-nums text-white">{formatChips(economy.chips)}</span>
          </span>
          <span className="text-[var(--text-mid)]">
            Stack <span className="font-semibold tabular-nums text-[var(--gold-2)]">{formatChips(game.tableStack)}</span>
          </span>
          {onRequestRescue && economy.chips < rate.buyInMin ? (
            <Button size="sm" variant="danger" onClick={onRequestRescue}>
              Get chips
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setRebuyOpen(true)}>
              Re-buy
            </Button>
          )}
        </div>
      </div>

      {/* Table stage — players ring the OUTSIDE of the felt; inside is community / pot / bet chips */}
      <div className="relative flex-1">
        <div className="holdem-stage relative mx-auto w-full max-w-5xl" style={{ aspectRatio: "16 / 8.6" }}>
          {/* felt region (inset); seats sit outside this box */}
          <div
            className="absolute"
            style={{
              left: `${FELT_INSET.left}%`,
              right: `${FELT_INSET.right}%`,
              top: `${FELT_INSET.top}%`,
              bottom: `${FELT_INSET.bottom}%`,
            }}
          >
            <PokerTable>
              {/* pot above, community board as the centrepiece */}
              <div className="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2">
                <PotDisplay amount={game.pot.amount} pulseKey={view.potPulseKey} reducedMotion={reducedMotion} />
              </div>
              <div className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2">
                <CommunityCards
                  cards={game.communityCards}
                  activeEvent={view.activeEvent}
                  reducedMotion={reducedMotion}
                  highlight={communityHighlight}
                />
              </div>

              {/* each seat's street bet chips, just inside the rail (+ chip-to-pot flight) */}
              {game.seats.map((seat) => {
                const slot = seatSlot(seat.seatIndex);
                const fly = view.chipFly?.seat === seat.seatIndex ? view.chipFly : null;
                if (seat.streetContribution <= 0 && !fly) return null;
                return (
                  <div
                    key={`bet-${seat.id}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${slot.bet.left}%`, top: `${slot.bet.top}%` }}
                  >
                    {seat.streetContribution > 0 && <ChipStack amount={seat.streetContribution} size="sm" />}
                    {fly && !reducedMotion && (
                      <div
                        key={fly.key}
                        className={`pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 ${
                          fly.kind === "toPot" ? "holdem-chip-fly" : "holdem-chip-award"
                        }`}
                        style={{ ["--fly-x" as string]: `${slot.fly.x}px`, ["--fly-y" as string]: `${slot.fly.y}px` }}
                      >
                        <ChipStack amount={fly.amount} size="sm" showAmount={false} />
                      </div>
                    )}
                  </div>
                );
              })}
            </PokerTable>
          </div>

          {/* seats OUTSIDE the felt */}
          {game.seats.map((seat) => {
            const slot = seatSlot(seat.seatIndex);
            const shownHoleCount = isDealing
              ? [0, 1].filter((ci) => view.dealtHoleCards.has(`${seat.seatIndex}-${ci}`)).length
              : seat.holeCards.length;
            const dealingIndexes =
              view.activeEvent?.type === "DEAL_HOLE" && view.activeEvent.seat === seat.seatIndex
                ? new Set<number>([view.activeEvent.cardIndex])
                : undefined;
            return (
              <div
                key={seat.id}
                className="absolute"
                style={{ left: `${slot.seat.left}%`, top: `${slot.seat.top}%`, transform: "translate(-50%, -50%)" }}
              >
                <Seat
                  seat={seat}
                  isTurn={isBetting && game.currentTurnSeatIndex === seat.seatIndex && !game.isAnimating}
                  isDealer={game.dealerButtonIndex === seat.seatIndex}
                  isSmallBlind={game.smallBlindIndex === seat.seatIndex}
                  isBigBlind={game.bigBlindIndex === seat.seatIndex}
                  isWinner={view.banner?.winners.includes(seat.seatIndex) ?? false}
                  shownHoleCount={shownHoleCount}
                  faceUp={seat.isHuman || view.flippedSeats.has(seat.seatIndex)}
                  dealingIndexes={dealingIndexes}
                  label={view.actionLabelBySeat.get(seat.seatIndex)}
                  thinking={view.thinkingSeat === seat.seatIndex}
                  highlight={view.highlightBySeat.get(seat.seatIndex)}
                  hero={slot.hero}
                  cardsBelow={slot.cardsBelow}
                  reducedMotion={reducedMotion}
                />
              </div>
            );
          })}
        </div>

        {/* Overlays: buy-in / deal / result */}
        {(game.phase === "buyIn" || game.phase === "unseated") && (
          <Overlay>
            {economy.chips >= rate.buyInMin ? (
              <div className="w-72 space-y-3">
                <h2 className="text-center font-display text-lg text-[var(--gold-2)]">Take a seat</h2>
                <BuyInControl rate={rate} chips={economy.chips} value={buyInAmount} onChange={setBuyInAmount} />
                <Button variant="gold" className="w-full" onClick={() => act(() => game.buyIn(buyInAmount))}>
                  Sit down — {formatChips(buyInAmount)}
                </Button>
              </div>
            ) : (
              <div className="flex max-w-xs flex-col items-center gap-3 text-center">
                <p className="text-sm text-red-200">
                  Not enough chips to sit at {rate.label} (need {formatChips(rate.buyInMin)}).
                </p>
                {onRequestRescue && (
                  <Button variant="danger" onClick={onRequestRescue}>
                    Get chips
                  </Button>
                )}
                {onExit && (
                  <Button variant="ghost" size="sm" onClick={onExit}>
                    ← Back to lobby
                  </Button>
                )}
              </div>
            )}
          </Overlay>
        )}

        {game.phase === "waitingHand" && (
          <Overlay>
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm text-[var(--text-mid)]">
                Your stack: <ChipStack amount={game.tableStack} size="sm" />
              </span>
              <Button variant="gold" onClick={() => act(() => game.startHand())} disabled={game.isAnimating}>
                Deal hand
              </Button>
            </div>
          </Overlay>
        )}

        <ResultBanner
          banner={view.banner}
          result={game.lastResult}
          seats={game.seats}
          playerSeatIndex={game.playerSeatIndex}
          reducedMotion={reducedMotion}
          onNextHand={() => act(() => game.startHand())}
          canNextHand={game.phase === "result" && !game.isAnimating}
        />
      </div>

      {/* Controls + log */}
      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <HoldemControls
          availableActions={game.availableActions}
          amountToCall={game.amountToCall}
          currentBet={game.currentBet}
          minRaise={game.minRaise}
          maxRaiseTo={game.maxRaiseTo}
          bigBlind={game.bigBlind}
          pot={game.pot.amount}
          allInAmount={game.availableActions.allIn.amount ?? game.effectiveAllInAmount}
          streetContribution={player?.streetContribution ?? 0}
          onFold={() => act(() => game.fold())}
          onCheck={() => act(() => game.check())}
          onCall={() => act(() => game.call())}
          onBet={(amount) => act(() => game.bet(amount))}
          onRaiseTo={(amount) => act(() => game.raiseTo(amount))}
          onAllIn={() => act(() => game.allIn())}
        />
        <div className="h-32 lg:h-auto">
          <ActionLog entries={log} />
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full border border-red-500/40 bg-black/85 px-4 py-2 text-sm text-red-200">
          {toast}
        </div>
      )}

      <RebuyModal
        open={rebuyOpen}
        rate={rate}
        chips={economy.chips}
        stack={game.tableStack}
        onClose={() => setRebuyOpen(false)}
        onRebuy={(amount) => {
          act(() => game.rebuy(amount));
          setRebuyOpen(false);
        }}
      />
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center">
      <div className="rounded-2xl border border-white/15 bg-black/80 px-6 py-5 backdrop-blur-sm">{children}</div>
    </div>
  );
}
