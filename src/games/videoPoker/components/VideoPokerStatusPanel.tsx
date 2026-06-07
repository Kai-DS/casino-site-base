import { formatChips } from "@/utils/format";

type VideoPokerStatusPanelProps = {
  chips: number; // wallet (UserProfile.chips)
  tableStack: number; // session bankroll on the table
  bet: number;
  coins: number;
  lastWin: number | null;
};

function Stat({
  label,
  value,
  tone = "white",
}: {
  label: string;
  value: string;
  tone?: "white" | "gold" | "neon" | "green";
}) {
  const toneClass =
    tone === "gold"
      ? "text-gold"
      : tone === "neon"
        ? "text-neon-blue"
        : tone === "green"
          ? "text-green-400"
          : "text-white";
  return (
    <div className="flex flex-col items-center px-3">
      <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      <span className={`text-base font-bold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

/** Always-visible session figures (spec §12.1, §14 StatusPanel). */
export function VideoPokerStatusPanel({ chips, tableStack, bet, coins, lastWin }: VideoPokerStatusPanelProps) {
  return (
    <div className="flex items-center justify-between divide-x divide-white/10 rounded-xl border border-gold-500/20 bg-black/50 py-2">
      <Stat label="Wallet" value={formatChips(chips)} tone="gold" />
      <Stat label="Table" value={formatChips(tableStack)} tone="neon" />
      <Stat label="Bet" value={`${formatChips(bet)} · ${coins}c`} />
      <Stat label="Last Win" value={lastWin && lastWin > 0 ? `+${formatChips(lastWin)}` : "—"} tone="green" />
    </div>
  );
}
