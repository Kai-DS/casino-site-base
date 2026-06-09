// games/texasHoldem/components/HoldemControls.tsx
// The action bar. RULE (spec §9.3 / §27): a button's enabled state and its disabled reason
// come ONLY from `availableActions` — the UI never re-derives whether call/raise is legal.
// The raise/bet slider is clamped to the logic-provided bounds so "looks pressable but gets
// rejected" can't happen.
import { useEffect, useMemo, useState } from "react";
import { formatChips } from "@/utils/format";
import { CasinoButton } from "@/components/casino/CasinoButton";
import { ChipStack } from "@/components/casino/ChipStack";
import type { AvailableActions } from "../types";
import { reasonText } from "./holdemLabels";

type HoldemControlsProps = {
  availableActions: AvailableActions;
  amountToCall: number;
  currentBet: number;
  minRaise: number;
  /** Max "raise-to" / bet target the logic allows (cap-limited). */
  maxRaiseTo: number;
  bigBlind: number;
  pot: number;
  tableStack: number;
  streetContribution: number;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onBet: (amount: number) => void;
  onRaiseTo: (amount: number) => void;
  onAllIn: () => void;
};

export function HoldemControls({
  availableActions,
  amountToCall,
  currentBet,
  minRaise,
  maxRaiseTo,
  bigBlind,
  pot,
  tableStack,
  streetContribution,
  onFold,
  onCheck,
  onCall,
  onBet,
  onRaiseTo,
  onAllIn,
}: HoldemControlsProps) {
  // Which of bet/raise the slider drives (only one is ever enabled at a time).
  const mode: "bet" | "raise" | null = availableActions.raise.enabled
    ? "raise"
    : availableActions.bet.enabled
      ? "bet"
      : null;

  const min = mode === "raise" ? currentBet + minRaise : bigBlind;
  const max = Math.max(min, maxRaiseTo);

  const [value, setValue] = useState(min);
  useEffect(() => {
    setValue((v) => Math.min(max, Math.max(min, v)));
  }, [min, max]);

  const presets = useMemo(() => {
    const half = streetContribution + Math.round(pot / 2);
    const full = streetContribution + pot;
    const clamp = (n: number) => Math.min(max, Math.max(min, n));
    return [
      { label: "Min", amount: clamp(min) },
      { label: "½ Pot", amount: clamp(half) },
      { label: "Pot", amount: clamp(full) },
      { label: "Max", amount: max },
    ];
  }, [min, max, pot, streetContribution]);

  // The chips this raise/bet actually pulls from the stack (for the preview).
  const chipDelta = Math.max(0, value - streetContribution);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/45 p-3">
      {mode && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
              {mode === "raise" ? "Raise to" : "Bet"}
            </span>
            <span className="font-display text-lg tabular-nums text-[var(--gold-2)]">{formatChips(value)}</span>
            <ChipStack amount={chipDelta} showAmount={false} size="sm" />
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={bigBlind}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full flex-1 accent-[var(--rail-hi)]"
            aria-label={mode === "raise" ? "Raise amount" : "Bet amount"}
          />
          <div className="flex gap-1">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setValue(p.amount)}
                className="focus-ring rounded-md border border-white/15 px-1.5 py-1 text-[10px] text-white/70 hover:bg-white/10"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-stretch justify-center gap-2">
        <CasinoButton
          tone="danger"
          disabled={!availableActions.fold.enabled}
          disabledReason={reasonText(availableActions.fold.reason)}
          onClick={onFold}
        >
          Fold
        </CasinoButton>

        <CasinoButton
          disabled={!availableActions.check.enabled}
          disabledReason={reasonText(availableActions.check.reason)}
          onClick={onCheck}
        >
          Check
        </CasinoButton>

        <CasinoButton
          tone="call"
          disabled={!availableActions.call.enabled}
          disabledReason={reasonText(availableActions.call.reason)}
          hint={amountToCall > 0 ? formatChips(amountToCall) : undefined}
          onClick={onCall}
        >
          Call
        </CasinoButton>

        <CasinoButton
          tone="raise"
          disabled={!availableActions.bet.enabled}
          disabledReason={reasonText(availableActions.bet.reason)}
          hint={formatChips(value)}
          onClick={() => onBet(value)}
        >
          Bet
        </CasinoButton>

        <CasinoButton
          tone="raise"
          disabled={!availableActions.raise.enabled}
          disabledReason={reasonText(availableActions.raise.reason)}
          hint={formatChips(value)}
          onClick={() => onRaiseTo(value)}
        >
          Raise
        </CasinoButton>

        <CasinoButton
          tone="gold"
          disabled={!availableActions.allIn.enabled}
          disabledReason={reasonText(availableActions.allIn.reason)}
          hint={formatChips(tableStack)}
          onClick={onAllIn}
        >
          All-in
        </CasinoButton>
      </div>
    </div>
  );
}
