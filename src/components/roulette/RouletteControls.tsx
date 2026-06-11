// components/roulette/RouletteControls.tsx
// The control bar. RULE (base spec §7.4): every button's enabled state + disabled reason comes ONLY
// from `availableActions` — the UI never re-derives legality. Also hosts the 通常/映画 animation-mode
// toggle (addendum §12). `clear` and `newBets` are kept distinct (never one dual-purpose button).
import { formatChips } from "@/utils/format";
import { CasinoButton } from "@/components/casino/CasinoButton";
import type { AvailableActions } from "@/games/roulette/types";
import type { RouletteAnimationMode } from "./animationMode";
import { reasonText } from "./rouletteLabels";

interface RouletteControlsProps {
  availableActions: AvailableActions;
  stagedTotal: number;
  mode: RouletteAnimationMode;
  reducedActive: boolean;
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
  reducedActive,
  onSpin,
  onUndo,
  onClear,
  onRebet,
  onNewBets,
  onModeChange,
}: RouletteControlsProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/45 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <ModeToggle mode={mode} reducedActive={reducedActive} onChange={onModeChange} />
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wide text-white/40">Bet total</div>
          <div className="font-display text-lg tabular-nums text-[var(--gold-2)]">{formatChips(stagedTotal)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch justify-center gap-2">
        <CasinoButton
          tone="neutral"
          disabled={!availableActions.undo.enabled}
          disabledReason={reasonText(availableActions.undo.reason)}
          onClick={onUndo}
        >
          Undo
        </CasinoButton>
        <CasinoButton
          tone="danger"
          disabled={!availableActions.clear.enabled}
          disabledReason={reasonText(availableActions.clear.reason)}
          onClick={onClear}
        >
          Clear
        </CasinoButton>
        <CasinoButton
          tone="gold"
          disabled={!availableActions.spin.enabled}
          disabledReason={reasonText(availableActions.spin.reason)}
          hint={availableActions.spin.enabled ? formatChips(availableActions.spin.amount ?? stagedTotal) : undefined}
          onClick={onSpin}
          className="min-w-[7rem]"
        >
          Spin
        </CasinoButton>
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
          tone="call"
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

function ModeToggle({
  mode,
  reducedActive,
  onChange,
}: {
  mode: RouletteAnimationMode;
  reducedActive: boolean;
  onChange: (mode: RouletteAnimationMode) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[9px] uppercase tracking-wide text-white/40">
        演出{reducedActive && <span className="ml-1 text-[var(--gold-2)]">（reduced motion 有効）</span>}
      </div>
      <div className="inline-flex overflow-hidden rounded-lg border border-white/15">
        <ModeButton active={mode === "standard"} title="テンポ重視の短いスピン演出" onClick={() => onChange("standard")}>
          通常
        </ModeButton>
        <ModeButton active={mode === "full"} title="ホイールへズームして落下まで見せる演出" onClick={() => onChange("full")}>
          映画
        </ModeButton>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`focus-ring px-3 py-1 text-xs font-semibold transition-colors ${
        active ? "bg-[var(--gold-2)] text-[#2a1d05]" : "bg-transparent text-white/70 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
