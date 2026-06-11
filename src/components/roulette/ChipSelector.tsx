// components/roulette/ChipSelector.tsx
// Chip denomination picker (§7.4). Dark-background contrast is explicit (rings + shadows) per the
// addendum §C3 visibility note. Selection is the only state; placement legality lives in the hook.
import { formatChips } from "@/utils/format";

interface ChipSelectorProps {
  denoms: readonly number[];
  selected: number;
  disabled?: boolean;
  onSelect: (value: number) => void;
}

// Token face colours by index (low → high): white, red, green, then gold for any extras.
const TOKENS = [
  { face: "#e9edf4", ring: "#aab3c2", ink: "#1a2030" },
  { face: "#c2293b", ring: "#f0a6ae", ink: "#fff" },
  { face: "#1f8a4c", ring: "#86e0ab", ink: "#fff" },
  { face: "#caa23c", ring: "#f6e3a1", ink: "#2a1d05" },
];

export function ChipSelector({ denoms, selected, disabled, onSelect }: ChipSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-white/45">Chip</span>
      <div className="flex gap-2">
        {denoms.map((value, i) => {
          const t = TOKENS[Math.min(i, TOKENS.length - 1)]!;
          const active = value === selected;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(value)}
              aria-pressed={active}
              className={`focus-ring relative flex h-11 w-11 items-center justify-center rounded-full border-2 text-[12px] font-bold tabular-nums shadow-[0_3px_8px_rgba(0,0,0,0.5)] transition-transform disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? "-translate-y-1 ring-2 ring-[var(--gold-2)] ring-offset-2 ring-offset-[#1a0f1f]" : "hover:-translate-y-0.5"
              }`}
              style={{
                background: `radial-gradient(circle at 50% 32%, ${t.face} 0%, #000 165%)`,
                borderColor: t.ring,
                color: t.ink,
              }}
            >
              {formatChips(value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
