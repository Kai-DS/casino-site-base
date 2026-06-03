import { useNavigate } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import { GAME_BY_ID } from "@/constants/games";
import { recentResults, statsByGame } from "@/repositories/historyRepository";
import { Button } from "@/components/common/Button";
import { ChipDisplay } from "@/components/common/ChipDisplay";
import { formatChips, formatSignedChips, formatDate, formatDateTime } from "@/utils/format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const user = useCasinoStore((s) => s.user);
  const results = useCasinoStore((s) => s.results);

  if (!user) return null;

  const recent = recentResults(results, 12);
  const perGame = statsByGame(results);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-gold">Profile</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate("/lobby")}>
          ← Lobby
        </Button>
      </div>

      {/* Identity card */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gold-500/30 bg-wine-800/70 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display text-2xl text-white">{user.name}</div>
          <div className="text-sm text-white/50">
            Level {user.level} · since {formatDate(user.createdAt)}
          </div>
        </div>
        <ChipDisplay chips={user.chips} size="lg" />
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Plays" value={formatChips(user.totalPlays)} />
        <Stat label="Wins" value={formatChips(user.wins)} />
        <Stat label="Net Profit" value={formatSignedChips(user.totalProfit)} />
        <Stat label="Level" value={String(user.level)} />
      </div>

      {/* Per-game breakdown */}
      {perGame.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl text-gold">By Game</h2>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/40 text-white/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Game</th>
                  <th className="px-4 py-2 text-right font-medium">Plays</th>
                  <th className="px-4 py-2 text-right font-medium">Wins</th>
                  <th className="px-4 py-2 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {perGame.map((s) => (
                  <tr key={s.gameId} className="border-t border-white/5">
                    <td className="px-4 py-2 text-white/85">{GAME_BY_ID[s.gameId].title}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.plays}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.wins}</td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        s.profit > 0 ? "text-green-400" : s.profit < 0 ? "text-red-300" : "text-white/60"
                      }`}
                    >
                      {formatSignedChips(s.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recent history */}
      <section className="space-y-2">
        <h2 className="font-display text-xl text-gold">Recent Plays</h2>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-white/50">
            No plays yet. Head to the lobby and take a seat.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-white/80">{GAME_BY_ID[r.gameId].title}</span>
                <span className="text-white/40">{formatDateTime(r.playedAt)}</span>
                <span
                  className={`w-20 text-right font-semibold tabular-nums ${
                    r.profit > 0 ? "text-green-400" : r.profit < 0 ? "text-red-300" : "text-white/60"
                  }`}
                >
                  {formatSignedChips(r.profit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ranking note (MVP — backend-dependent, spec §7.8) */}
      <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xs text-white/45">
        Cross-player rankings require a backend and arrive after Supabase. For now, stats are
        per-device.
      </p>
    </div>
  );
}
