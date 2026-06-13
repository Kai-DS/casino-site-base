// components/roulette/RouletteControls.tsx
// The leather control rail (Perspective Redesign §7): [mode + BET TOTAL] | [ChipSelector] |
// [UNDO CLEAR REBET NEW BETS] [SPIN]. RULE (base spec §7.4): every button's enabled state + disabled
// reason comes ONLY from `availableActions`; the UI never re-derives legality. Disabled stays READABLE
// (ink-dim, not opacity-crushed). `clear` and `newBets` are kept distinct.
import type { ReactNode } from "react";
import { formatChips } from "@/utils/format";
import type { AvailableActions } from "@/games/roulette/types";
import type { RouletteAnimationMode } from "./animationMode";
import { reasonText } from "./rouletteLabels";

interface RouletteControlsProps {
  availableActions: AvailableActions;
  stagedTotal: number;
  mode: RouletteAnimationMode;
  chipSelector: ReactNode;
  onSpin: () => void;
  onUndo: () => void;
  onClear: () => void;
  onRebet: () => void;
  onNewBets: () => void;
  onModeChange: (mode: RouletteAnimationMode) => void;
}

export function RouletteControls({
  availableActions,
  stagedTotal,
  mode,
  chipSelector,
  onSpin,
  onUndo,
  onClear,
  onRebet,
  onNewBets,
  onModeChange,
}: RouletteControlsProps) {
  const spin = availableActions.spin;
  return (
    <div className="flex h-full flex-wrap items-center justify-between gap-3">
      {/* left: mode + bet total */}
      <div className="flex shrink-0 items-center gap-3">
        <div>
          <div className="mb-1 text-[9px] uppercase tracking-wide text-[var(--rl-ink-dim)]">
            演出
          </div>
          <div className="inline-flex overflow-hidden rounded-md border border-[var(--rl-gold)]/40">
            <ModeBtn active={mode === "standard"} title="テンポ重視の短い3Dスピン" onClick={() => onModeChange("standard")}>通常</ModeBtn>
            <ModeBtn active={mode === "full"} title="ホイールに寄って落下まで見せる3D演出" onClick={() => onModeChange("full")}>ロング</ModeBtn>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[var(--rl-ink-dim)]">Bet total</div>
          <div className="font-display text-xl tabular-nums text-[var(--rl-gold-hi)]">{formatChips(stagedTotal)}</div>
        </div>
      </div>

      {/* center: chips */}
      <div className="order-last flex w-full justify-center sm:order-none sm:w-auto sm:flex-1">{chipSelector}</div>

      {/* right: actions + SPIN */}
      <div className="flex shrink-0 items-center gap-2">
        <Pill av={availableActions.undo} onClick={onUndo}>Undo</Pill>
        <Pill av={availableActions.clear} onClick={onClear} danger>Clear</Pill>
        <Pill av={availableActions.rebet} onClick={onRebet} hint={availableActions.rebet.amount}>Rebet</Pill>
        <Pill av={availableActions.newBets} onClick={onNewBets}>New Bets</Pill>
        <button
          type="button"
          disabled={!spin.enabled}
          title={spin.enabled ? undefined : reasonText(spin.reason)}
          onClick={onSpin}
          className="rl-spin-btn focus-ring flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full font-display text-[#2a1d05]"
        >
          <span className="text-lg font-bold tracking-wide">SPIN</span>
          {spin.enabled && <span className="text-[11px] font-semibold tabular-nums">{formatChips(spin.amount ?? stagedTotal)}</span>}
        </button>
      </div>
    </div>
  );
}

function Pill({
  av,
  onClick,
  children,
  danger,
  hint,
}: {
  av: { enabled: boolean; reason?: import("@/games/roulette/types").RouletteActionError; amount?: number };
  onClick: () => void;
  children: string;
  danger?: boolean;
  hint?: number;
}) {
  return (
    <button
      type="button"
      disabled={!av.enabled}
      title={av.enabled ? undefined : reasonText(av.reason)}
      onClick={onClick}
      className={`rl-pill focus-ring flex flex-col items-center rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide ${danger ? "!border-red-400/50" : ""}`}
    >
      <span>{children}</span>
      {hint != null && av.enabled ? <span className="text-[9px] tabular-nums opacity-80">{formatChips(hint)}</span> : null}
    </button>
  );
}

function ModeBtn({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`focus-ring px-3 py-1 text-xs font-semibold transition-colors ${active ? "bg-[var(--rl-gold)] text-[#2a1d05]" : "bg-transparent text-[var(--rl-ink-dim)] hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}
