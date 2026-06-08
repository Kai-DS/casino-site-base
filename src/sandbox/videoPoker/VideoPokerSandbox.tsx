import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Rate } from "@/types/casino";
import { RATES } from "@/constants/rates";
import {
  VideoPokerGame,
  type VideoPokerDebugSnapshot,
} from "@/games/videoPoker/components/VideoPokerGame";
import { ChipDisplay } from "@/components/common/ChipDisplay";
import { Button } from "@/components/common/Button";
import { formatChips, formatSignedChips } from "@/utils/format";
import { useMockEconomy } from "../useMockEconomy";
import { SCENARIOS } from "./scenarios";

/**
 * /sandbox/video-poker — isolated harness for polishing Video Poker.
 * Same game logic as production, with a mock economy + fixed-deck scenarios (spec §33).
 */
export function VideoPokerSandbox() {
  const [rate, setRate] = useState<Rate>(RATES[0]!);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [debug, setDebug] = useState<VideoPokerDebugSnapshot | null>(null);
  const economy = useMockEconomy(1000);

  const wins = useMemo(() => economy.log.filter((p) => p.profit > 0).length, [economy.log]);
  const net = useMemo(() => economy.log.reduce((a, p) => a + p.profit, 0), [economy.log]);

  const scenarioDeck = scenarioId ? SCENARIOS.find((s) => s.id === scenarioId)?.deck : undefined;

  return (
    <div className="casino-backdrop min-h-screen px-4 py-6">
      <div className="mx-auto max-w-6xl">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gold-500/40 bg-black/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-gold-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-gold">
              Sandbox
            </span>
            <span className="text-sm text-white/60">Video Poker · mock economy</span>
          </div>
          <div className="flex items-center gap-2">
            <ChipDisplay chips={economy.chips} size="sm" />
            <Button size="sm" variant="ghost" onClick={() => economy.topUp(1000)}>
              +1,000
            </Button>
            <Button size="sm" variant="ghost" onClick={() => economy.reset()}>
              Reset
            </Button>
            <Link
              to="/"
              className="focus-ring rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/60 hover:bg-white/10"
            >
              Exit
            </Link>
          </div>
        </div>

        {/* Rate switcher */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          {RATES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRate(r)}
              className={`focus-ring rounded-lg border px-3 py-1.5 text-sm transition ${
                r.id === rate.id
                  ? "border-gold-500 bg-felt-700 text-gold"
                  : "border-white/15 text-white/60 hover:bg-white/10"
              }`}
            >
              {r.label} <span className="text-white/40">bet {r.betMin}–{r.betMax}</span>
            </button>
          ))}
        </div>

        {/* Fixed-deck scenarios (select, then press DEAL) */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5">
          <span className="mr-1 text-xs uppercase tracking-wide text-white/40">Deck:</span>
          <button
            type="button"
            onClick={() => setScenarioId(null)}
            className={`focus-ring rounded border px-2 py-1 text-xs transition ${
              scenarioId === null
                ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                : "border-white/15 text-white/55 hover:bg-white/10"
            }`}
          >
            Random
          </button>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenarioId(s.id)}
              className={`focus-ring rounded border px-2 py-1 text-xs transition ${
                scenarioId === s.id
                  ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                  : "border-white/15 text-white/55 hover:bg-white/10"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* The real game component */}
          <div className="h-[78vh] min-h-[600px]">
            <VideoPokerGame
              key={rate.id}
              rate={rate}
              economy={economy}
              initialTableStack={Math.min(rate.buyInMax, economy.chips)}
              deckProvider={scenarioDeck ? () => scenarioDeck : undefined}
              onInsufficient={() => economy.topUp(1000)}
              onDebug={setDebug}
            />
          </div>

          {/* Dev panel: debug state + stats + play log */}
          <aside className="space-y-3">
            {/* Debug readout (spec §33.1) */}
            <div className="rounded-xl border border-emerald-500/20 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/70">
              <div className="mb-1 font-bold uppercase tracking-wide text-emerald-300/80">Debug</div>
              <Row k="phase" v={debug?.phase ?? "—"} />
              <Row k="animating" v={String(debug?.isAnimating ?? false)} />
              <Row k="handId" v={String(debug?.handId ?? 0)} />
              <Row k="coins" v={String(debug?.coinCount ?? 0)} />
              <Row k="bet" v={formatChips(debug?.currentBet ?? 0)} />
              <Row k="lockedBet" v={debug?.lockedBet == null ? "null" : formatChips(debug.lockedBet)} />
              <Row k="tableStack" v={formatChips(debug?.tableStack ?? 0)} />
              <Row k="category" v={debug?.lastCategory ?? "—"} />
              <Row k="payout" v={debug?.lastPayout == null ? "—" : formatChips(debug.lastPayout)} />
              <Row k="winIdx" v={debug?.winningCardIndexes?.join(",") || "—"} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Plays" value={String(economy.plays)} />
              <Stat label="Wins" value={String(wins)} />
              <Stat
                label="Net"
                value={formatSignedChips(net)}
                tone={net > 0 ? "green" : net < 0 ? "red" : "muted"}
              />
            </div>

            <div className="max-h-[36vh] overflow-y-auto rounded-xl border border-white/10">
              {economy.log.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-white/40">No hands yet.</p>
              ) : (
                <ul className="divide-y divide-white/5 text-sm">
                  {economy.log.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-white/60">bet {formatChips(p.bet)}</span>
                      <span className="text-white/40">→ {formatChips(p.payout)}</span>
                      <span
                        className={`w-16 text-right font-semibold tabular-nums ${
                          p.profit > 0 ? "text-green-400" : p.profit < 0 ? "text-red-300" : "text-white/60"
                        }`}
                      >
                        {formatSignedChips(p.profit)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/40">{k}</span>
      <span className="text-emerald-200/90">{v}</span>
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
    <div className="rounded-lg border border-white/10 bg-black/30 py-2">
      <div className="text-[10px] uppercase text-white/40">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
