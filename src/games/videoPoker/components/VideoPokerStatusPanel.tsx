import { formatChips } from "@/utils/format";

type VideoPokerStatusPanelProps = {
  chips: number; // wallet (UserProfile.chips)
  tableStack: number; // session bankroll on the table
  bet: number;
  coins: number;
  lastWin: number | null;
};

function Meter({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center px-2 sm:px-4">
      <span className="text-[9px] uppercase tracking-[0.2em] text-neon-green/50">{label}</span>
      <span
        className={`vp-meter font-display text-lg leading-tight sm:text-2xl ${
          accent ? "text-gold-400 [text-shadow:0_0_8px_rgba(240,199,94,0.6)]" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** LCD credit meter across the top of the screen (spec §12.1). */
export function VideoPokerStatusPanel({ chips, tableStack, bet, coins, lastWin }: VideoPokerStatusPanelProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neon-green/20 bg-black/40 px-2 py-1.5">
      <Meter label="Credits" value={formatChips(chips)} />
      <Meter label="Table" value={formatChips(tableStack)} />
      <Meter label={`Bet · ${coins}c`} value={formatChips(bet)} />
      <Meter label="Win" value={lastWin && lastWin > 0 ? formatChips(lastWin) : "—"} accent={!!lastWin && lastWin > 0} />
    </div>
  );
}
