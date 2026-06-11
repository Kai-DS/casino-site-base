// components/roulette/HistoryStrip.tsx
// Last 12 results, newest first (§7.5). History is populated by the logic at BALL_LAND ack, so it is
// already reveal-gated — a spin's number never appears here before its ball lands.
import type { SpinResult } from "@/games/roulette/types";
import { POCKET_BG_CLASS } from "./rouletteLabels";

export function HistoryStrip({ history }: { history: readonly SpinResult[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-white/45">History</span>
      <div className="flex flex-1 gap-1 overflow-x-auto">
        {history.length === 0 && <span className="text-[11px] text-white/30">—</span>}
        {history.map((r, i) => (
          <span
            key={`${r.number}-${i}`}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/15 text-[11px] font-bold tabular-nums text-white ${POCKET_BG_CLASS[r.color]}`}
            title={`${r.number}`}
          >
            {r.number}
          </span>
        ))}
      </div>
    </div>
  );
}
