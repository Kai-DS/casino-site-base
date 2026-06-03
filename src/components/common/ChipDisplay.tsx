import { useEffect, useRef, useState } from "react";
import { formatChips } from "@/utils/format";

type ChipDisplayProps = {
  chips: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "text-sm px-2.5 py-1 gap-1.5",
  md: "text-base px-3.5 py-1.5 gap-2",
  lg: "text-2xl px-5 py-2.5 gap-2.5",
} as const;

function ChipIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#d4af37" stroke="#b8941f" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="2 2" />
      <circle cx="12" cy="12" r="2.5" fill="#fff" />
    </svg>
  );
}

/** Chip balance pill that pops when the value changes (spec §7.6 "残高表示"). */
export function ChipDisplay({ chips, size = "md", className = "" }: ChipDisplayProps) {
  const [pop, setPop] = useState(false);
  const prev = useRef(chips);

  useEffect(() => {
    if (prev.current !== chips) {
      prev.current = chips;
      setPop(true);
      const t = setTimeout(() => setPop(false), 400);
      return () => clearTimeout(t);
    }
  }, [chips]);

  const iconSize = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  return (
    <span
      className={`inline-flex items-center rounded-full border border-gold-500/50 bg-black/40 font-semibold tabular-nums text-gold ${SIZES[size]} ${className}`}
      aria-label={`${formatChips(chips)} chips`}
    >
      <ChipIcon className={`${iconSize} ${pop ? "animate-chipPop" : ""}`} />
      {formatChips(chips)}
    </span>
  );
}
