import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Rate } from "@/types/casino";
import { RATES } from "@/constants/rates";
import { VideoPokerGame } from "@/games/videoPoker/components/VideoPokerGame";
import { ChipDisplay } from "@/components/common/ChipDisplay";
import { Button } from "@/components/common/Button";
import { formatChips, formatSignedChips } from "@/utils/format";
import { useMockEconomy } from "./useMockEconomy";

/**
 * /sandbox/video-poker — isolated harness for polishing Video Poker.
 * Same game logic as production, but the economy is a mock (no login/lobby/store).
 * Re-integration cost is zero: VideoPokerPage just swaps this mock for useStoreEconomy.
 */
export function VideoPokerSandbox() {
  const [rate, setRate] = useState<Rate>(RATES[0]!);
  const economy = useMockEconomy(1000);

  const wins = useMemo(() => economy.log.filter((p) => p.profit > 0).length, [economy.log]);
  const net = useMemo(() => economy.log.reduce((a, p) => a + p.profit, 0), [economy.log]);

  return (
    <div className="casino-backdrop min-h-screen px-4 py-6">
      <div className="mx-auto max-w-5xl">
        {/* Sandbox toolbar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gold-500/40 bg-black/30 px-4 py-3">
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

        {/* Rate switcher (sandbox-only convenience) */}
        <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
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
              {r.label} <span className="text-white/40">×{r.betUnit}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* The real game component, fed the mock economy */}
          <VideoPokerGame
            rate={rate}
            economy={economy}
            onInsufficient={() => economy.topUp(1000)}
          />

          {/* Dev panel: stats + play log */}
          <aside className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-white/10 bg-black/30 py-2">
                <div className="text-[10px] uppercase text-white/40">Plays</div>
                <div className="text-lg font-semibold tabular-nums">{economy.plays}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 py-2">
                <div className="text-[10px] uppercase text-white/40">Wins</div>
                <div className="text-lg font-semibold tabular-nums">{wins}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 py-2">
                <div className="text-[10px] uppercase text-white/40">Net</div>
                <div
                  className={`text-lg font-semibold tabular-nums ${
                    net > 0 ? "text-green-400" : net < 0 ? "text-red-300" : "text-white/60"
                  }`}
                >
                  {formatSignedChips(net)}
                </div>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-white/10">
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
