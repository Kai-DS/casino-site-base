// components/roulette/RouletteTable.tsx
// The vertical 12×3 betting layout (§7.2). Hit zones come from tableLayout.ts; a tap calls
// onPlace(positionId) and the hook validates. The UI reads `cappedPositionIds` (dim) and reveal-gated
// winning info — it never decides legality or who won. Chips are drawn from `positionTotals`.
import { useMemo, useState } from "react";
import { ChipStack } from "@/components/casino/ChipStack";
import { colorOf } from "@/games/roulette/constants/wheel";
import type { PositionId } from "@/games/roulette/types";
import { POCKET_FILL } from "./rouletteLabels";
import { TABLE_LAYOUT, type HitZone } from "./tableLayout";

interface RouletteTableProps {
  positionTotals: Readonly<Record<PositionId, number>>;
  cappedPositionIds: readonly PositionId[];
  interactive: boolean;
  /** Winning number once the ball has landed (reveal-gated); null hides all win/lose styling. */
  winningNumber: number | null;
  onPlace: (positionId: PositionId) => void;
}

const pct = (v: number) => `${v * 100}%`;

export function RouletteTable({ positionTotals, cappedPositionIds, interactive, winningNumber, onPlace }: RouletteTableProps) {
  const [hovered, setHovered] = useState<HitZone | null>(null);
  const capped = useMemo(() => new Set(cappedPositionIds), [cappedPositionIds]);
  const revealed = winningNumber != null;

  const cells = TABLE_LAYOUT.zones.filter((z) => z.layer === "cell" || z.layer === "outside");
  const edges = TABLE_LAYOUT.zones.filter((z) => z.layer === "edge" || z.layer === "corner");
  const chipZones = TABLE_LAYOUT.zones.filter((z) => (positionTotals[z.id] ?? 0) > 0);

  const hoveredCovered = useMemo(() => new Set(hovered?.covered ?? []), [hovered]);

  return (
    <div
      className="relative w-full select-none [container-type:inline-size]"
      style={{ aspectRatio: String(TABLE_LAYOUT.aspect) }}
      onMouseLeave={() => setHovered(null)}
    >
      {/* number + outside cells */}
      {cells.map((z) => {
        const isNumber = z.kind === "straight";
        const n = isNumber ? z.covered[0]! : null;
        const fill = isNumber ? POCKET_FILL[colorOf(n!)] : "rgba(20,28,24,0.85)";
        const isWin = revealed && winningNumber != null && z.covered.includes(winningNumber);
        const isLose = revealed && !isWin;
        const preview = hoveredCovered.size > 0 && n != null && hoveredCovered.has(n);
        return (
          <button
            key={z.id}
            type="button"
            disabled={!interactive}
            onMouseEnter={() => setHovered(z)}
            onClick={() => onPlace(z.id)}
            className={`absolute flex items-center justify-center rounded-[3px] border text-[clamp(8px,1.4cqw,15px)] font-bold tabular-nums text-white transition-all ${
              isWin ? "z-[1] border-[var(--gold-2)] ring-1 ring-[var(--gold-2)]" : "border-black/50"
            } ${isLose ? "opacity-35 grayscale" : ""} ${preview ? "brightness-150" : ""} ${capped.has(z.id) ? "opacity-50" : ""}`}
            style={{
              left: pct(z.x),
              top: pct(z.y),
              width: pct(z.w),
              height: pct(z.h),
              background: fill,
              boxShadow: isWin ? "0 0 10px rgba(244,214,128,0.8)" : undefined,
            }}
          >
            {isNumber ? n : <span className="text-[clamp(7px,1.1cqw,11px)] font-semibold uppercase tracking-tight">{z.label}</span>}
          </button>
        );
      })}

      {/* split / corner / street / six-line — thin transparent hit bands on top */}
      {edges.map((z) => {
        const isWin = revealed && winningNumber != null && z.covered.includes(winningNumber);
        return (
          <button
            key={z.id}
            type="button"
            disabled={!interactive}
            onMouseEnter={() => setHovered(z)}
            onClick={() => onPlace(z.id)}
            aria-label={z.id}
            className={`absolute rounded-[2px] transition-colors ${
              isWin ? "bg-[var(--gold-2)]/40" : "bg-transparent hover:bg-white/25"
            } ${capped.has(z.id) ? "ring-1 ring-red-400/40" : ""}`}
            style={{ left: pct(z.x), top: pct(z.y), width: pct(z.w), height: pct(z.h), zIndex: 2 }}
          />
        );
      })}

      {/* chip stacks (display only) */}
      {chipZones.map((z) => (
        <div
          key={`chip-${z.id}`}
          className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-1/2"
          style={{ left: pct(z.x + z.w / 2), top: pct(z.y + z.h / 2) }}
        >
          <ChipStack amount={positionTotals[z.id] ?? 0} showAmount={false} size="sm" />
        </div>
      ))}
    </div>
  );
}
