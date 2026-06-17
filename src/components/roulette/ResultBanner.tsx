// components/roulette/ResultBanner.tsx
// Post-spin dark-glass banner (Perspective Redesign §9). Rendered ONLY from the queue's reveal-gated
// `banner` accumulator, so it can never appear before BALL_LAND completes. Lives in the overlay layer
// (outside the table tilt).
import { formatChips } from "@/utils/format";
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
    <div
      className="pointer-events-auto w-full max-w-md rounded-2xl border border-[var(--rl-gold)]/45 p-4 text-[var(--rl-ink)]"
      style={{ background: "rgba(10,8,6,0.82)", backdropFilter: "blur(6px)", boxShadow: "0 18px 50px rgba(0,0,0,0.6)" }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-2 border-white/30 font-display text-3xl font-bold text-white"
          style={{ background: POCKET_FILL[result.color] }}
        >
          {result.number}
        </div>
        <div className="grid flex-1 grid-cols-5 gap-1 text-center">
          {meta.map((m) => (
            <div key={m.label}>
              <div className="text-[8px] uppercase tracking-wide text-[var(--rl-ink-dim)]">{m.label}</div>
              <div className="text-[11px] font-semibold">{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="BET" value={formatChips(totalBet)} />
        <Stat label="RETURNED" value={formatChips(totalReturned)} />
        <div className="rounded-lg bg-black/30 px-2 py-1">
          <div className="text-[9px] uppercase tracking-wide text-[var(--rl-ink-dim)]">PROFIT</div>
          <div className={`text-sm font-bold tabular-nums ${win ? "text-[var(--rl-gold-hi)]" : profit < 0 ? "text-[#c98] " : ""}`}>
            {profit > 0 ? "+" : ""}
            {formatChips(profit)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-2">
        <RbBtn enabled={availableActions.rebet.enabled} reason={reasonText(availableActions.rebet.reason)} hint={availableActions.rebet.amount} onClick={onRebet}>
          Rebet
        </RbBtn>
        <RbBtn gold enabled={availableActions.newBets.enabled} reason={reasonText(availableActions.newBets.reason)} onClick={onNewBets}>
          New Bets
        </RbBtn>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/30 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-[var(--rl-ink-dim)]">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function RbBtn({
  enabled,
  reason,
  hint,
  gold,
  onClick,
  children,
}: {
  enabled: boolean;
  reason?: string;
  hint?: number;
  gold?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      title={enabled ? undefined : reason}
      onClick={onClick}
      className={`focus-ring flex flex-col items-center rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wide ${
        gold ? "rl-spin-btn !h-auto !w-auto text-[#2a1d05]" : "rl-pill"
      }`}
    >
      <span>{children}</span>
      {hint != null && enabled ? <span className="text-[10px] tabular-nums opacity-80">{formatChips(hint)}</span> : null}
    </button>
  );
}
