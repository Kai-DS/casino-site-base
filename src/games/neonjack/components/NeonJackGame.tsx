import type { Rate } from "@/types/casino";
import { useNeonJack } from "./useNeonJack";
import { SYMBOL_GLYPH, SYMBOL_COLOR, BET_MEDALS } from "../data/reels";
import type { SlotSymbol, SpinRole } from "../types";
import { formatChips } from "@/utils/format";

const ROLE_MESSAGE: Record<SpinRole, string> = {
  big: "🎉 BIG BONUS!",
  reg: "✨ REG BONUS!",
  grape: "🍇 GRAPE",
  cherry: "🍒 CHERRY",
  replay: "↻ REPLAY",
  blank: "—",
};

function Reel({ symbol, spinning }: { symbol: SlotSymbol; spinning: boolean }) {
  return (
    <div className="relative flex h-24 w-20 items-center justify-center overflow-hidden rounded-lg border-2 border-neon-blue/40 bg-black shadow-[inset_0_0_18px_rgba(0,0,0,0.9)] sm:h-28 sm:w-24">
      <span
        className={`font-display text-4xl font-extrabold sm:text-5xl ${SYMBOL_COLOR[symbol]} ${
          spinning ? "blur-[2px] opacity-80" : "drop-shadow-[0_0_8px_currentColor]"
        }`}
      >
        {SYMBOL_GLYPH[symbol]}
      </span>
      {/* centre payline */}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-neon-red/60" />
    </div>
  );
}

type NeonJackGameProps = {
  rate: Rate;
  onInsufficient: () => void;
};

/** The NEON JACK cabinet — black × blue neon, GOGO! lamp, 3 reels, red SPIN. (spec §9.1) */
export function NeonJackGame({ rate, onInsufficient }: NeonJackGameProps) {
  const { reels, spinningReels, phase, lastSpin, lampOn, spinCost, canSpin, spin } = useNeonJack(
    rate,
    onInsufficient,
  );

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-neon-blue/30 bg-neon-bg p-5 shadow-[0_0_40px_rgba(40,215,255,0.15)] sm:p-7">
      {/* GOGO! lamp */}
      <div className="mb-4 flex justify-center">
        <div
          className={`rounded-full border-2 px-6 py-2 font-display text-xl font-black tracking-widest transition-all ${
            lampOn
              ? "animate-glowPulse border-neon-blue bg-neon-deep text-neon-blue"
              : "border-white/10 bg-black/60 text-white/15"
          }`}
        >
          GOGO!
        </div>
      </div>

      {/* Reels */}
      <div className="flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-neon-deep to-black p-4">
        {reels.map((sym, i) => (
          <Reel key={i} symbol={sym} spinning={spinningReels[i] ?? false} />
        ))}
      </div>

      {/* Result line */}
      <div className="mt-4 flex h-8 items-center justify-center">
        {lastSpin ? (
          <span
            className={`font-semibold ${
              lastSpin.payoutMedals > lastSpin.betMedals
                ? "text-neon-blue"
                : lastSpin.payoutMedals === lastSpin.betMedals
                  ? "text-white/60"
                  : "text-white/40"
            }`}
          >
            {ROLE_MESSAGE[lastSpin.role]}
            {lastSpin.payoutMedals > 0 && ` · +${lastSpin.payoutMedals} medals`}
          </span>
        ) : (
          <span className="text-white/30">{phase === "spinning" ? "spinning…" : "press SPIN"}</span>
        )}
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="text-xs text-white/50">
          BET <span className="font-bold text-neon-blue">{BET_MEDALS}</span> medals
          <br />
          cost <span className="font-bold text-gold">{formatChips(spinCost)}</span> chips
        </div>

        <button
          type="button"
          onClick={spin}
          disabled={!canSpin}
          className="focus-ring h-20 w-20 rounded-full bg-gradient-to-b from-red-500 to-red-700 font-display text-lg font-black text-white shadow-[0_0_20px_rgba(255,59,92,0.6)] transition active:scale-90 disabled:from-neutral-600 disabled:to-neutral-800 disabled:opacity-60"
        >
          {phase === "spinning" ? "···" : "SPIN"}
        </button>

        {/* Decorative lever */}
        <div className="flex flex-col items-center text-white/40" aria-hidden="true">
          <div className={`h-10 w-2 rounded-full bg-neon-blue/40 ${phase === "spinning" ? "translate-y-2" : ""} transition-transform`} />
          <div className="h-4 w-4 rounded-full bg-neon-red shadow-neon" />
          <span className="mt-1 text-[10px]">LEVER</span>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-white/30">
        Rate ×{rate.betUnit} · {rate.betUnit} chip{rate.betUnit === 1 ? "" : "s"} per medal
      </p>
    </div>
  );
}
