import { useEffect } from "react";
import { formatChips } from "@/utils/format";

export type WinFxTier = "big" | "royal";

type VideoPokerWinFxProps = {
  tier: WinFxTier;
  label: string;
  amount: number;
  onDone: () => void;
};

const SPARKLES = [
  { top: "12%", left: "18%", delay: "0ms" },
  { top: "20%", left: "78%", delay: "180ms" },
  { top: "62%", left: "10%", delay: "320ms" },
  { top: "70%", left: "84%", delay: "120ms" },
  { top: "38%", left: "50%", delay: "260ms" },
  { top: "82%", left: "44%", delay: "420ms" },
];

/** Celebratory overlay: strong for quads/straight-flush, grand for Royal Flush (spec §12.8). */
export function VideoPokerWinFx({ tier, label, amount, onDone }: VideoPokerWinFxProps) {
  useEffect(() => {
    const t = window.setTimeout(onDone, tier === "royal" ? 3200 : 1900);
    return () => clearTimeout(t);
  }, [tier, onDone]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
      {tier === "royal" && <div className="vp-royal-bg absolute inset-0" />}

      {tier === "royal" &&
        SPARKLES.map((s, i) => (
          <span
            key={i}
            className="vp-sparkle absolute text-gold-300"
            style={{ top: s.top, left: s.left, animationDelay: s.delay }}
          >
            ✦
          </span>
        ))}

      <div className="vp-fx-pop relative text-center">
        <div
          className={`font-display font-black uppercase tracking-widest ${
            tier === "royal"
              ? "text-4xl text-gold-300 [text-shadow:0_0_18px_rgba(240,199,94,0.9)] sm:text-6xl"
              : "text-2xl text-gold [text-shadow:0_0_12px_rgba(240,199,94,0.7)] sm:text-4xl"
          }`}
        >
          {label}
        </div>
        <div
          className={`mt-1 font-display font-bold tabular-nums text-white ${
            tier === "royal" ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
          }`}
        >
          WIN +{formatChips(amount)}
        </div>
      </div>
    </div>
  );
}
