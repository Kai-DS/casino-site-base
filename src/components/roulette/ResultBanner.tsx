// components/roulette/ResultBanner.tsx
// Post-spin banner (§7.5 / addendum §6.7). Rendered ONLY from the queue's reveal-gated `banner`
// accumulator, so it can never appear before BALL_LAND completes.
import { formatChips } from "@/utils/format";
import { CasinoButton } from "@/components/casino/CasinoButton";
import type { AvailableActions } from "@/games/roulette/types";
import type { RouletteBannerView } from "./useRouletteAnimationQueue";
import { POCKET_FILL, reasonText, resultMeta } from "./rouletteLabels";

interface ResultBannerProps {
  banner: RouletteBannerView;
  availableActions: AvailableActions;
  onRebet: () => void;
  onNewBets: () => void;
}

export function ResultBanner({ banner, availableActions, onRebet, onNewBets }: ResultBannerProps) {
  const { result, totalBet, totalReturned, profit } = banner;
  const win = profit > 0;
  const meta = resultMeta(result);

  return (
    <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-[var(--gold-2)]/40 bg-[#120a16]/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/30 font-display text-3xl font-bold text-white shadow-inner"
          style={{ background: POCKET_FILL[result.color] }}
        >
          {result.number}
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-1 text-center">
            {meta.map((m) => (
              <div key={m.label}>
                <div className="text-[8px] uppercase tracking-wide text-white/40">{m.label}</div>
                <div className="text-[11px] font-semibold text-white/90">{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="BET" value={formatChips(totalBet)} />
        <Stat label="RETURNED" value={formatChips(totalReturned)} />
        <div className="rounded-lg bg-black/30 px-2 py-1">
          <div className="text-[9px] uppercase tracking-wide text-white/40">PROFIT</div>
          <div className={`text-sm font-bold tabular-nums ${win ? "text-emerald-300" : profit < 0 ? "text-red-300" : "text-white/80"}`}>
            {profit > 0 ? "+" : ""}
            {formatChips(profit)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-2">
        <CasinoButton
          tone="neutral"
          disabled={!availableActions.rebet.enabled}
          disabledReason={reasonText(availableActions.rebet.reason)}
          hint={availableActions.rebet.amount ? formatChips(availableActions.rebet.amount) : undefined}
          onClick={onRebet}
        >
          Rebet
        </CasinoButton>
        <CasinoButton
          tone="gold"
          disabled={!availableActions.newBets.enabled}
          disabledReason={reasonText(availableActions.newBets.reason)}
          onClick={onNewBets}
        >
          New Bets
        </CasinoButton>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/30 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="text-sm font-bold tabular-nums text-white/90">{value}</div>
    </div>
  );
}
