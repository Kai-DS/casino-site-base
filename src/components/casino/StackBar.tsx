import type { Rate } from "@/types/casino";
import { ChipDisplay } from "@/components/common/ChipDisplay";
import { Button } from "@/components/common/Button";
import { formatChips } from "@/utils/format";

type StackBarProps = {
  rate: Rate;
  chips: number; // wallet (total wealth)
  stack: number | null; // chips on the table this session
  onRebuy: () => void;
};

/** Shows wallet vs table stack, and prompts a re-buy when the stack can't cover one bet. */
export function StackBar({ rate, chips, stack, onRebuy }: StackBarProps) {
  if (stack === null) return null;
  const low = stack < rate.betMin;
  const pct = rate.buyInMax > 0 ? Math.min(100, (stack / rate.buyInMax) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5">
      <div className="flex flex-col text-[11px] text-white/45">
        <span>Wallet</span>
        <ChipDisplay chips={chips} size="sm" />
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between text-[11px] text-white/45">
          <span>Table stack</span>
          <span className="tabular-nums text-white/70">{formatChips(stack)}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${low ? "bg-red-500" : "bg-gold-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {low && (
        <Button size="sm" variant="gold" onClick={onRebuy}>
          Re-buy
        </Button>
      )}
    </div>
  );
}
