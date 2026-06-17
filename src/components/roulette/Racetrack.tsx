// components/roulette/Racetrack.tsx
// Compact oval racetrack (Perspective Redesign §6), sized to the aux-row. Numbers are laid out in
// WHEEL_ORDER (single source) — tapping a node places a neighbours bet (center ± n straights); the
// four call-bet buttons expand to inside positions via the hook. The racetrack only ISSUES placements;
// chips live on the main board. Cost is always shown.
import { useState } from "react";
import { formatChips } from "@/utils/format";
import { WHEEL_ORDER, colorOf } from "@/games/roulette/constants/wheel";
import { CALL_BET_DEFS, type CallBetId } from "@/games/roulette/constants/callBets";
import { POCKET_FILL } from "./rouletteLabels";
import { pointOnCircle } from "./wheelGeometry";

interface RacetrackProps {
  selectedChip: number;
  neighborRange: { min: number; max: number; default: number };
  interactive: boolean;
  onCallBet: (id: CallBetId) => void;
  onNeighbors: (center: number, n: number) => void;
}

const SECTOR = 360 / WHEEL_ORDER.length;
const RX = 47;
const RY = 13.5;
const CX = 50;
const CY = 17;
const CALL_ORDER: CallBetId[] = ["voisins", "tiers", "orphelins", "jeuZero"];
const SHORT: Record<CallBetId, string> = { voisins: "VOISINS", tiers: "TIERS", orphelins: "ORPHEL.", jeuZero: "JEU 0" };

export function Racetrack({ selectedChip, neighborRange, interactive, onCallBet, onNeighbors }: RacetrackProps) {
  const [n, setN] = useState(neighborRange.default);

  return (
    <div className="flex h-full flex-col rounded-lg border border-[var(--rl-gold)]/25 bg-black/30 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wide text-[var(--rl-ink-dim)]">Racetrack · neighbours ±</span>
        <div className="flex gap-0.5">
          {Array.from({ length: neighborRange.max - neighborRange.min + 1 }, (_, i) => neighborRange.min + i).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setN(v)}
              aria-pressed={v === n}
              className={`h-4 w-4 rounded text-[9px] font-bold ${v === n ? "bg-[var(--rl-gold)] text-[#2a1d05]" : "border border-[var(--rl-gold)]/40 text-[var(--rl-ink-dim)]"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 100 34" className="w-full" style={{ height: 56 }} role="group" aria-label="Racetrack numbers">
        <ellipse cx={CX} cy={CY} rx={RX + 2.5} ry={RY + 3} fill="none" stroke="var(--rl-gold)" strokeOpacity={0.3} strokeWidth={0.6} />
        {WHEEL_ORDER.map((num, i) => {
          const u = pointOnCircle(0, 0, 1, i * SECTOR);
          const x = CX + u.x * RX;
          const y = CY + u.y * RY;
          return (
            <g key={num} role="button" tabIndex={interactive ? 0 : -1} style={{ cursor: interactive ? "pointer" : "default" }} onClick={() => interactive && onNeighbors(num, n)}>
              <circle cx={x} cy={y} r={2.3} fill={POCKET_FILL[colorOf(num)]} stroke="var(--rl-gold)" strokeWidth={0.3} strokeOpacity={0.5} />
              <text x={x} y={y} fill="#fff" fontSize={1.9} fontWeight={700} textAnchor="middle" dominantBaseline="central">
                {num}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-auto grid grid-cols-4 gap-1">
        {CALL_ORDER.map((id) => {
          const def = CALL_BET_DEFS[id];
          return (
            <button
              key={id}
              type="button"
              disabled={!interactive}
              onClick={() => onCallBet(id)}
              className="rl-pill rounded px-1 py-1 text-left leading-tight disabled:cursor-not-allowed"
            >
              <div className="text-[9px] font-bold text-[var(--rl-gold-hi)]">{SHORT[id]}</div>
              <div className="text-[8px] tabular-nums text-[var(--rl-ink-dim)]">{def.chipCount}×{formatChips(selectedChip)}={formatChips(def.chipCount * selectedChip)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
