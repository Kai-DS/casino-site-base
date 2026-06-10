import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "gold" | "call" | "raise" | "danger";

type CasinoButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  /** Shown as a tooltip while disabled — e.g. the availableActions reason (spec §24.10). */
  disabledReason?: string;
  /** Small label under the main text, e.g. the call amount. */
  hint?: ReactNode;
  children: ReactNode;
};

const TONES: Record<Tone, string> = {
  neutral: "from-white/12 to-white/5 text-white border-white/20",
  gold: "from-gold-400 to-gold-600 text-wine-900 border-gold-300 font-bold",
  call: "from-emerald-400 to-emerald-600 text-emerald-950 border-emerald-300 font-bold",
  raise: "from-amber-400 to-amber-600 text-amber-950 border-amber-300 font-bold",
  danger: "from-red-500 to-red-700 text-white border-red-300 font-semibold",
};

/**
 * Premium felt-table button (spec §24.10): hover lift + glow, press scale-down, and a clear
 * dimmed/disabled state whose tooltip explains *why* it is disabled. The "can I press this?"
 * decision is the caller's — pass `disabled` straight from `availableActions[kind].enabled`.
 */
export const CasinoButton = forwardRef<HTMLButtonElement, CasinoButtonProps>(function CasinoButton(
  { tone = "neutral", disabledReason, hint, className = "", disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-disabled={disabled}
      className={`focus-ring relative inline-flex min-w-[4.5rem] flex-col items-center justify-center rounded-xl border bg-gradient-to-b px-4 py-2 text-sm leading-tight shadow-[0_6px_16px_rgba(0,0,0,0.4)] transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_10px_22px_rgba(0,0,0,0.5)] active:translate-y-0 active:scale-95 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:brightness-75 disabled:hover:-translate-y-0 ${TONES[tone]} ${className}`}
      {...rest}
    >
      <span className="font-display uppercase tracking-wide">{children}</span>
      {hint != null && hint !== "" && <span className="text-[10px] font-semibold tabular-nums opacity-80">{hint}</span>}
    </button>
  );
});
