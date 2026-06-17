// components/roulette/RouletteTable.tsx
// The betting board, drawn as a single SVG "printed on the felt" (spec §4.3). Chips, dolly, hover
// preview and the win/lose styling all live INSIDE this SVG, so they share the board's coordinate
// system and ride the table tilt automatically (§3.2.1, §4.4). Hit zones come from tableLayout.ts;
// a tap calls onPlace(positionId). The UI never decides legality or who won.
import { useMemo, useState } from "react";
import { colorOf } from "@/games/roulette/constants/wheel";
import type { PositionId } from "@/games/roulette/types";
import { buildTableLayout, type HitZone, type Orientation } from "./tableLayout";

interface RouletteTableProps {
  positionTotals: Readonly<Record<PositionId, number>>;
  cappedPositionIds: readonly PositionId[];
  interactive: boolean;
  /** Winning number once the ball has landed (reveal-gated); null hides all win/lose styling. */
  winningNumber: number | null;
  orientation?: Orientation;
  onPlace: (positionId: PositionId) => void;
}

const FILL: Record<string, string> = { red: "var(--rl-red)", black: "var(--rl-black)", green: "var(--rl-zero)" };

export function RouletteTable({
  positionTotals,
  cappedPositionIds,
  interactive,
  winningNumber,
  orientation = "landscape",
  onPlace,
}: RouletteTableProps) {
  const layout = buildTableLayout(orientation);
  const [hovered, setHovered] = useState<HitZone | null>(null);
  const capped = useMemo(() => new Set(cappedPositionIds), [cappedPositionIds]);
  const hoveredCovered = useMemo(() => new Set(hovered?.covered ?? []), [hovered]);
  const revealed = winningNumber != null;

  const cells = layout.zones.filter((z) => z.kind === "straight");
  const outside = layout.zones.filter((z) => z.layer === "outside");
  const hitZones = layout.zones; // all clickable; paint order = corners last → on top
  const chipZones = layout.zones.filter((z) => (positionTotals[z.id] ?? 0) > 0);
  const numScale = orientation === "portrait" ? 0.74 : 1;
  const erx = orientation === "portrait" ? 30 : 21;
  const ery = orientation === "portrait" ? 22 : 25;

  return (
    <svg viewBox={`0 0 ${layout.vbW} ${layout.vbH}`} className="h-full w-full select-none" role="group" aria-label="Roulette betting table">
      <defs>
        <linearGradient id="rlGoldMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF3B0" />
          <stop offset="0.25" stopColor="#F6E27A" />
          <stop offset="0.5" stopColor="#D4AF37" />
          <stop offset="0.75" stopColor="#9A7A2A" />
          <stop offset="1" stopColor="#F1DD8C" />
        </linearGradient>
      </defs>

      {/* number cells — felt-printed colour tile + ellipse frame + serif number */}
      {cells.map((z) => {
        const n = z.covered[0]!;
        const isWin = revealed && n === winningNumber;
        const preview = hoveredCovered.has(n);
        return (
          <g key={z.id} pointerEvents="none">
            <rect x={z.x + 5} y={z.y + 5} width={z.w - 10} height={z.h - 10} rx={6} fill={FILL[colorOf(n)]} fillOpacity={0.92} stroke="var(--rl-line)" strokeWidth={1.4} />
            <rect x={z.x + 5} y={z.y + 5} width={z.w - 10} height={(z.h - 10) * 0.4} rx={6} fill="#ffffff" opacity={0.05} />
            <ellipse cx={z.cx} cy={z.cy} rx={erx} ry={ery} fill="none" stroke="var(--rl-line)" strokeWidth={1.2} opacity={0.7} />
            <text x={z.cx} y={z.cy} fill="var(--rl-ink)" fontSize={26 * numScale} fontWeight={600} fontFamily="Georgia, 'Times New Roman', serif" textAnchor="middle" dominantBaseline="central">
              {n}
            </text>
            {(isWin || preview) && (
              <rect x={z.x + 4} y={z.y + 4} width={z.w - 8} height={z.h - 8} rx={7} fill={isWin ? "rgba(244,214,128,0.16)" : "rgba(212,175,55,0.10)"} stroke="var(--rl-gold)" strokeWidth={isWin ? 2.4 : 1.2} />
            )}
          </g>
        );
      })}

      {/* outside cells — lines + label; RED/BLACK as rhombus */}
      {outside.map((z) => {
        const isRhombus = z.id === "red" || z.id === "black";
        const isWin = revealed && winningNumber != null && z.covered.includes(winningNumber);
        const r = Math.min(z.h * 0.34, 16);
        return (
          <g key={z.id} pointerEvents="none" opacity={capped.has(z.id) ? 0.5 : 1}>
            <rect x={z.x + 3} y={z.y + 3} width={z.w - 6} height={z.h - 6} rx={6} fill="none" stroke="var(--rl-line)" strokeWidth={1.4} opacity={0.85} />
            {isRhombus ? (
              <path d={`M ${z.cx} ${z.cy - r} L ${z.cx + r} ${z.cy} L ${z.cx} ${z.cy + r} L ${z.cx - r} ${z.cy} Z`} fill={z.id === "red" ? "var(--rl-red-hi)" : "var(--rl-black-hi)"} stroke="var(--rl-gold)" strokeWidth={1.4} />
            ) : (
              <text x={z.cx} y={z.cy} fill="var(--rl-ink)" fontSize={z.id.startsWith("column") ? 22 : 18} fontStyle="italic" fontFamily="Georgia, serif" textAnchor="middle" dominantBaseline="central">
                {z.label}
              </text>
            )}
            {isWin && <rect x={z.x + 3} y={z.y + 3} width={z.w - 6} height={z.h - 6} rx={6} fill="rgba(244,214,128,0.14)" stroke="var(--rl-gold)" strokeWidth={2} />}
          </g>
        );
      })}

      {/* outer gold frame */}
      <rect x={1.5} y={1.5} width={layout.vbW - 3} height={layout.vbH - 3} rx={10} fill="none" stroke="url(#rlGoldMetal)" strokeWidth={2} opacity={0.5} />

      {/* hit zones (transparent; edges/corners highlight on hover) */}
      {hitZones.map((z) => {
        const isEdge = z.layer === "edge" || z.layer === "corner";
        const showHover = hovered?.id === z.id && isEdge;
        return (
          <rect
            key={`hit-${z.id}`}
            aria-label={z.id}
            x={z.x}
            y={z.y}
            width={z.w}
            height={z.h}
            rx={isEdge ? 2 : 6}
            fill={showHover ? "rgba(212,175,55,0.28)" : "transparent"}
            style={{ cursor: interactive ? "pointer" : "default", pointerEvents: interactive ? "auto" : "none" }}
            onMouseEnter={() => setHovered(z)}
            onMouseLeave={() => setHovered((h) => (h?.id === z.id ? null : h))}
            onClick={() => interactive && onPlace(z.id)}
          />
        );
      })}

      {/* chips */}
      {chipZones.map((z) => (
        <ChipMark key={`chip-${z.id}`} x={z.cx} y={z.cy} amount={positionTotals[z.id] ?? 0} />
      ))}

      {/* dolly on the winning number */}
      {revealed &&
        winningNumber != null &&
        (() => {
          const wz = cells.find((z) => z.covered[0] === winningNumber);
          if (!wz) return null;
          return (
            <g pointerEvents="none">
              <ellipse cx={wz.cx} cy={wz.y + 13} rx={9} ry={4} fill="url(#rlGoldMetal)" stroke="#6b5212" strokeWidth={1} />
              <rect x={wz.cx - 4} y={wz.y + 4} width={8} height={12} rx={2} fill="url(#rlGoldMetal)" stroke="#6b5212" strokeWidth={0.8} />
              <ellipse cx={wz.cx} cy={wz.y + 4} rx={5} ry={2.4} fill="#FFF3B0" />
            </g>
          );
        })()}
    </svg>
  );
}

function ChipMark({ x, y, amount }: { x: number; y: number; amount: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={14} fill="#14110c" stroke="var(--rl-gold)" strokeWidth={1.6} />
      <circle cx={x} cy={y} r={11} fill="none" stroke="var(--rl-gold-hi)" strokeWidth={1} strokeDasharray="3 3" opacity={0.8} />
      <text x={x} y={y} fill="var(--rl-ink)" fontSize={11} fontWeight={700} textAnchor="middle" dominantBaseline="central">
        {amount}
      </text>
    </g>
  );
}
