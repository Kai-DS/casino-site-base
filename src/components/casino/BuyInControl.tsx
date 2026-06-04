import { clampBuyIn } from "@/constants/rates";
import type { Rate } from "@/types/casino";
import { formatChips } from "@/utils/format";

type BuyInControlProps = {
  rate: Rate;
  chips: number;
  value: number;
  onChange: (amount: number) => void;
};

/** Pick how many chips to bring to the table, within [buyInMin, min(buyInMax, chips)]. */
export function BuyInControl({ rate, chips, value, onChange }: BuyInControlProps) {
  const max = Math.min(rate.buyInMax, chips);
  const min = rate.buyInMin;
  const set = (n: number) => onChange(clampBuyIn(rate, n, chips));

  const presets: { label: string; amount: number }[] = [
    { label: "Min", amount: min },
    { label: "½", amount: Math.round((min + max) / 2 / rate.betMin) * rate.betMin },
    { label: "Max", amount: max },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <span className="text-sm text-white/60">Bring to table</span>
        <span className="font-display text-2xl text-gold tabular-nums">{formatChips(value)}</span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={rate.betMin}
        value={Math.min(value, max)}
        onChange={(e) => set(Number(e.target.value))}
        className="w-full accent-gold-500"
        aria-label="Buy-in amount"
      />

      <div className="flex items-center justify-between text-[11px] text-white/40">
        <span>{formatChips(min)}</span>
        <span>{formatChips(max)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => set(p.amount)}
            className={`focus-ring rounded-lg border px-2 py-1.5 text-sm transition ${
              value === clampBuyIn(rate, p.amount, chips)
                ? "border-gold-500 bg-felt-700 text-gold"
                : "border-white/15 text-white/60 hover:bg-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
