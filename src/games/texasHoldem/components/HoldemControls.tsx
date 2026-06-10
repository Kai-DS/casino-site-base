// games/texasHoldem/components/HoldemControls.tsx
// The action bar. RULE (spec §9.3 / §27): a button's enabled state and its disabled reason come
// ONLY from `availableActions`; the UI never re-derives whether call/raise is legal. The bet/raise
// slider is clamped to the logic-provided bounds, and 3BET / ALL-IN are presets over the existing
// raiseTo / allIn — no new logic action is introduced.
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
  streetContribution: number;
  /** All-in target from the logic (availableActions.allIn.amount ?? effectiveAllInAmount). */
  allInAmount: number;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onBet: (amount: number) => void;
  onRaiseTo: (amount: number) => void;
  onAllIn: () => void;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function HoldemControls({
  availableActions,
  amountToCall,
  currentBet,
  minRaise,
  maxRaiseTo,
  bigBlind,
  pot,
  streetContribution,
  allInAmount,
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

  // Slider bounds come straight from the contract — never recomputed legality (§9.3).
  const min = mode === "raise" ? currentBet + minRaise : bigBlind;
  const max = Math.max(min, maxRaiseTo);

  const [value, setValue] = useState(min);
  useEffect(() => {
    setValue((v) => clamp(v, min, max));
  }, [min, max]);

  // 3BET preset: a big re-raise = 3× the current bet, clamped into the legal raise range.
  // Only natural (and enabled) when a raise is legal (which implies currentBet > 0).
  const threeBetEnabled = availableActions.raise.enabled && currentBet > 0;
  const threeBetAmount = clamp(currentBet * 3, currentBet + minRaise, maxRaiseTo);

  const presets = useMemo(() => {
    const c = (n: number) => clamp(n, min, max);
    return [
      { label: "Min", amount: c(min) },
      { label: "½ Pot", amount: c(streetContribution + Math.round(pot / 2)) },
      { label: "Pot", amount: c(streetContribution + pot) },
      { label: "Max", amount: max },
    ];
  }, [min, max, pot, streetContribution]);

  const chipDelta = Math.max(0, value - streetContribution);
  const bump = (delta: number) => setValue((v) => clamp(v + delta, min, max));

  return (
    <div className="rounded-2xl border border-white/10 bg-black/45 p-3">
      {mode && (
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center justify-center gap-3">
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
              {mode === "raise" ? "Raise to" : "Bet"}
            </span>
            <span className="font-display text-2xl tabular-nums text-[var(--gold-2)]">{formatChips(value)}</span>
            <ChipStack amount={chipDelta} showAmount={false} size="sm" />
          </div>

          {/* fine adjust + slider (§ slider near the action buttons) */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <StepButton onClick={() => bump(-5)}>-5</StepButton>
              <StepButton onClick={() => bump(-1)}>-1</StepButton>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={value}
              onChange={(e) => setValue(clamp(Number(e.target.value), min, max))}
              className="h-2 flex-1 accent-[var(--rail-hi)]"
              aria-label={mode === "raise" ? "Raise amount" : "Bet amount"}
            />
            <div className="flex gap-1">
              <StepButton onClick={() => bump(1)}>+1</StepButton>
              <StepButton onClick={() => bump(5)}>+5</StepButton>
            </div>
          </div>

          <div className="flex justify-center gap-1">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setValue(p.amount)}
                className="focus-ring rounded-md border border-white/15 px-2 py-1 text-[10px] text-white/70 hover:bg-white/10"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FOLD / CHECK / CALL / BET / RAISE / 3BET / ALL-IN */}
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
          tone="raise"
          disabled={!threeBetEnabled}
          disabledReason={reasonText(availableActions.raise.reason)}
          hint={threeBetEnabled ? formatChips(threeBetAmount) : undefined}
          onClick={() => onRaiseTo(threeBetAmount)}
        >
          3-Bet
        </CasinoButton>

        <CasinoButton
          tone="gold"
          disabled={!availableActions.allIn.enabled}
          disabledReason={reasonText(availableActions.allIn.reason)}
          hint={formatChips(allInAmount)}
          onClick={onAllIn}
        >
          All-in
        </CasinoButton>
      </div>
    </div>
  );
}

function StepButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring h-7 w-8 rounded-md border border-white/15 text-[11px] font-bold tabular-nums text-white/80 hover:bg-white/10"
    >
      {children}
    </button>
  );
}
