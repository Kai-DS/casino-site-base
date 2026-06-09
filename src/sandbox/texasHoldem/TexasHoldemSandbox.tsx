import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Rate } from "@/types/casino";
import { RATES } from "@/constants/rates";
import { Button } from "@/components/common/Button";
import { ChipDisplay } from "@/components/common/ChipDisplay";
import { formatChips, formatSignedChips } from "@/utils/format";
import { useTexasHoldem, type UseTexasHoldemReturn } from "@/games/texasHoldem/useTexasHoldem";
import { TexasHoldemGame } from "@/games/texasHoldem/components/TexasHoldemGame";
import type { ActionAvailability, HoldemActionKind, HoldemSeat } from "@/games/texasHoldem/types";
import { useMockEconomy } from "../useMockEconomy";
import {
  findHoldemSandboxScenario,
  HOLDEM_SANDBOX_SCENARIOS,
  type HoldemSandboxScenarioId,
} from "./scenarios";

const DEFAULT_BUY_IN = 100;

function isBettingPhase(phase: UseTexasHoldemReturn["phase"]) {
  return phase === "preflop" || phase === "flop" || phase === "turn" || phase === "river";
}

export function TexasHoldemSandbox() {
  const [rate, setRate] = useState<Rate>(RATES[0]!);
  const [scenarioId, setScenarioId] = useState<HoldemSandboxScenarioId>("showdown-player-win");
  const [animationEnabled, setAnimationEnabled] = useState(false);
  const [visual, setVisual] = useState(false);
  const economy = useMockEconomy(1000);
  const scenario = findHoldemSandboxScenario(scenarioId);

  return (
    <div className="casino-backdrop min-h-screen px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-gold-500/40 bg-black/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-gold-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-gold">
              Sandbox
            </span>
            <span className="text-sm text-white/60">Texas Hold'em · logic harness</span>
          </div>
          <div className="flex items-center gap-2">
            <ChipDisplay chips={economy.chips} size="sm" />
            <Button size="sm" variant="ghost" onClick={() => economy.topUp(1000)}>+1,000</Button>
            <Button size="sm" variant="ghost" onClick={() => economy.reset()}>Reset</Button>
            <Link
              to="/"
              className="focus-ring rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/60 hover:bg-white/10"
            >
              Exit
            </Link>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          {RATES.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setRate(candidate)}
              className={`focus-ring rounded-lg border px-3 py-1.5 text-sm transition ${
                candidate.id === rate.id
                  ? "border-gold-500 bg-felt-700 text-gold"
                  : "border-white/15 text-white/60 hover:bg-white/10"
              }`}
            >
              {candidate.label} <span className="text-white/40">blind {candidate.betMin}/{candidate.betMin * 2}</span>
            </button>
          ))}
          <label className="ml-2 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70">
            <input
              type="checkbox"
              checked={animationEnabled}
              onChange={(event) => setAnimationEnabled(event.target.checked)}
            />
            animation events
          </label>
          <label
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
              visual ? "border-gold-500 bg-felt-700 text-gold" : "border-white/15 text-white/70"
            }`}
          >
            <input type="checkbox" checked={visual} onChange={(event) => setVisual(event.target.checked)} />
            Visual UI
          </label>
        </div>

        {visual ? (
          <div className="min-h-[640px]">
            <TexasHoldemGame key={rate.id} rate={rate} economy={economy} animationEnabled />
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5">
              <span className="mr-1 text-xs uppercase tracking-wide text-white/40">Scenario:</span>
              {HOLDEM_SANDBOX_SCENARIOS.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setScenarioId(candidate.id)}
                  className={`focus-ring rounded border px-2 py-1 text-xs transition ${
                    scenarioId === candidate.id
                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                      : "border-white/15 text-white/55 hover:bg-white/10"
                  }`}
                >
                  {candidate.label}
                </button>
              ))}
            </div>

            <HoldemSandboxHarness
              key={`${rate.id}-${scenario.id}-${animationEnabled}`}
              rate={rate}
              scenarioId={scenario.id}
              animationEnabled={animationEnabled}
              economy={economy}
            />
          </>
        )}
      </div>
    </div>
  );
}

function HoldemSandboxHarness({
  rate,
  scenarioId,
  animationEnabled,
  economy,
}: {
  rate: Rate;
  scenarioId: HoldemSandboxScenarioId;
  animationEnabled: boolean;
  economy: ReturnType<typeof useMockEconomy>;
}) {
  const scenario = findHoldemSandboxScenario(scenarioId);
  const [buyInAmount, setBuyInAmount] = useState(DEFAULT_BUY_IN);
  const [actionAmount, setActionAmount] = useState(4);
  const [autoRun, setAutoRun] = useState(false);
  const game = useTexasHoldem({
    rate,
    economy,
    animationEnabled,
    deckProvider: () => scenario.deck,
    rng: () => 0,
  });
  const player = useMemo(
    () => game.seats.find((seat) => seat.seatIndex === game.playerSeatIndex) ?? null,
    [game.playerSeatIndex, game.seats],
  );
  const net = useMemo(() => economy.log.reduce((total, play) => total + play.profit, 0), [economy.log]);

  useEffect(() => {
    if (!autoRun) return;
    if (game.phase === "result") {
      setAutoRun(false);
      return;
    }
    const id = window.setTimeout(() => {
      if (game.animationEvents.length > 0) {
        game.onAnimationEventComplete(game.animationEvents[0]!.id);
        return;
      }
      if (game.phase === "buyIn" || game.phase === "unseated") {
        game.buyIn(Math.min(Math.max(buyInAmount, rate.buyInMin), rate.buyInMax));
        return;
      }
      if (game.phase === "waitingHand") {
        game.startHand();
        return;
      }
      if (!isBettingPhase(game.phase) || game.currentTurnSeatIndex !== game.playerSeatIndex) return;
      if (scenarioId === "fold-win" && game.phase === "preflop") {
        game.raiseTo(game.currentBet + game.minRaise);
        return;
      }
      if (scenarioId === "all-in-auto-reveal" && game.phase === "preflop") {
        game.allIn();
        return;
      }
      if (game.amountToCall > 0) game.call();
      else game.check();
    }, 0);
    return () => window.clearTimeout(id);
  }, [autoRun, buyInAmount, game, rate.buyInMax, rate.buyInMin, scenarioId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-black/35 p-4">
          <div className="mb-3">
            <h1 className="text-xl font-semibold text-white">{scenario.label}</h1>
            <p className="text-sm text-white/55">{scenario.description}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Phase" value={game.phase} />
            <Stat label="Turn" value={game.currentTurnSeatIndex == null ? "-" : `seat ${game.currentTurnSeatIndex}`} />
            <Stat label="Pot" value={formatChips(game.pot.amount)} />
            <Stat label="Current bet" value={formatChips(game.currentBet)} />
            <Stat label="To call" value={formatChips(game.amountToCall)} />
            <Stat label="Cap" value={formatChips(game.handContributionCap)} />
            <Stat label="Stack" value={formatChips(game.tableStack)} />
            <Stat label="Deck" value={String(game.deckRemaining)} />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/35 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={rate.buyInMin}
              max={rate.buyInMax}
              value={buyInAmount}
              onChange={(event) => setBuyInAmount(Number(event.target.value))}
              className="w-24 rounded border border-white/15 bg-black/40 px-2 py-1 text-sm text-white"
            />
            <Button size="sm" onClick={() => game.buyIn(buyInAmount)} disabled={game.phase !== "buyIn" && game.phase !== "unseated"}>
              Buy in
            </Button>
            <Button size="sm" onClick={() => game.startHand()} disabled={game.phase !== "waitingHand" && game.phase !== "result"}>
              Start hand
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAutoRun((value) => !value)}>
              {autoRun ? "Stop headless" : "Run headless"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => game.fold()} disabled={!game.availableActions.fold.enabled}>Fold</Button>
            <Button size="sm" onClick={() => game.check()} disabled={!game.availableActions.check.enabled}>Check</Button>
            <Button size="sm" onClick={() => game.call()} disabled={!game.availableActions.call.enabled}>Call</Button>
            <input
              type="number"
              min={0}
              value={actionAmount}
              onChange={(event) => setActionAmount(Number(event.target.value))}
              className="w-20 rounded border border-white/15 bg-black/40 px-2 py-1 text-sm text-white"
            />
            <Button size="sm" onClick={() => game.bet(actionAmount)} disabled={!game.availableActions.bet.enabled}>Bet</Button>
            <Button size="sm" onClick={() => game.raiseTo(actionAmount)} disabled={!game.availableActions.raise.enabled}>Raise to</Button>
            <Button size="sm" variant="danger" onClick={() => game.allIn()} disabled={!game.availableActions.allIn.enabled}>All-in</Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {game.seats.map((seat) => (
            <SeatPanel key={seat.id} seat={seat} isPlayer={seat.id === player?.id} />
          ))}
        </div>

        <div className="rounded-lg border border-white/10 bg-black/35 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-white/40">Community</div>
          <div className="flex flex-wrap gap-2 font-mono text-sm">
            {game.communityCards.length === 0 ? <span className="text-white/35">none</span> : game.communityCards.map((card) => (
              <span key={card.id} className="rounded border border-white/15 px-2 py-1 text-white/75">{card.id}</span>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-3">
        <div className="rounded-lg border border-emerald-500/20 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/70">
          <div className="mb-1 font-bold uppercase tracking-wide text-emerald-300/80">Available actions</div>
          {Object.entries(game.availableActions).map(([action, availability]) => (
            <ActionRow key={action} action={action as HoldemActionKind} availability={availability} />
          ))}
        </div>

        <div className="rounded-lg border border-sky-500/20 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/70">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-bold uppercase tracking-wide text-sky-300/80">Animation events</span>
            <Button size="sm" variant="ghost" onClick={() => game.animationEvents[0] && game.onAnimationEventComplete(game.animationEvents[0].id)}>
              Ack head
            </Button>
          </div>
          {game.animationEvents.length === 0 ? (
            <div className="text-white/35">empty</div>
          ) : (
            <ol className="space-y-1">
              {game.animationEvents.map((event, index) => (
                <li key={event.id} className="rounded border border-white/10 px-2 py-1">
                  {index}. {event.type}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Plays" value={String(economy.plays)} />
          <Stat label="Net" value={formatSignedChips(net)} tone={net > 0 ? "green" : net < 0 ? "red" : "muted"} />
          <Stat label="Wallet" value={formatChips(economy.chips)} />
        </div>

        <div className="rounded-lg border border-white/10 bg-black/35 p-3 text-sm text-white/65">
          <div className="mb-1 font-semibold text-white/80">Last result</div>
          {game.lastResult ? (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed">
              {JSON.stringify(game.lastResult, null, 2)}
            </pre>
          ) : (
            <div className="text-white/35">none</div>
          )}
        </div>
      </aside>
    </div>
  );
}

function SeatPanel({ seat, isPlayer }: { seat: HoldemSeat; isPlayer: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${isPlayer ? "border-gold-500/40 bg-gold-500/10" : "border-white/10 bg-black/30"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-white/85">{seat.name}</span>
        <span className="text-xs text-white/45">#{seat.seatIndex}</span>
      </div>
      <Row label="status" value={seat.status} />
      <Row label="stack" value={formatChips(seat.tableStack)} />
      <Row label="street" value={formatChips(seat.streetContribution)} />
      <Row label="total" value={formatChips(seat.totalContribution)} />
      <Row label="acted" value={String(seat.hasActed)} />
      <Row label="last" value={seat.lastAction ?? "-"} />
      <div className="mt-2 flex flex-wrap gap-1 font-mono text-xs">
        {seat.holeCards.length === 0 ? <span className="text-white/30">no cards</span> : seat.holeCards.map((card) => (
          <span key={card.id} className="rounded border border-white/15 px-1.5 py-0.5 text-white/70">{card.id}</span>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/40">{label}</span>
      <span className="text-white/75">{value}</span>
    </div>
  );
}

function ActionRow({ action, availability }: { action: HoldemActionKind; availability: ActionAvailability }) {
  return (
    <div className="flex justify-between gap-2">
      <span className={availability.enabled ? "text-emerald-300" : "text-white/45"}>{action}</span>
      <span>{availability.enabled ? "enabled" : availability.reason ?? "disabled"}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "white",
}: {
  label: string;
  value: string;
  tone?: "white" | "green" | "red" | "muted";
}) {
  const toneClass =
    tone === "green" ? "text-green-400" : tone === "red" ? "text-red-300" : tone === "muted" ? "text-white/60" : "text-white";
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
