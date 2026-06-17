// components/roulette/HistoryStrip.tsx
// Last 12 results as pocket-coloured coins, newest first + slightly larger (Perspective Redesign §8).
// History is populated by the logic at BALL_LAND ack, so it is already reveal-gated — a spin's number
// never appears here before its ball lands.
import type { SpinResult } from "@/games/roulette/types";
import { POCKET_FILL } from "./rouletteLabels";

export function HistoryStrip({ history }: { history: readonly SpinResult[] }) {
  return (
    <div className="flex w-full items-center gap-1.5">
      <span className="shrink-0 text-[9px] uppercase tracking-wide text-[var(--rl-ink-dim)]">Hist</span>
      <div className="flex flex-1 gap-1 overflow-x-auto">
        {history.length === 0 && <span className="text-[11px] text-[var(--rl-ink-dim)]">—</span>}
        {history.map((r, i) => (
          <span
            key={`${r.number}-${i}`}
            className={`flex shrink-0 items-center justify-center rounded-full border font-bold tabular-nums text-white ${
              i === 0 ? "border-[var(--rl-gold-hi)]" : "border-[var(--rl-gold)]/45"
            }`}
            style={{
              width: i === 0 ? 28 : 24,
              height: i === 0 ? 28 : 24,
              fontSize: i === 0 ? 12 : 11,
              background: POCKET_FILL[r.color],
              boxShadow: i === 0 ? "0 0 8px rgba(244,214,128,0.55)" : undefined,
            }}
            title={`${r.number}`}
          >
            {r.number}
          </span>
        ))}
      </div>
    </div>
  );
}
