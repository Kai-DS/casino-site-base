// components/roulette/Racetrack.tsx
// Oval racetrack input device (§7.3). Numbers are laid out in WHEEL_ORDER (single source) — tapping a
// node places a neighbours bet (center ± n straights); the four call-bet zones expand to inside
// positions via the hook. The racetrack only ISSUES placements; the chips live on the main table.
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
// Ellipse node positions in a 100×56 viewBox.
const RX = 45;
const RY = 22;
const CX = 50;
const CY = 28;

const CALL_ORDER: CallBetId[] = ["voisins", "tiers", "orphelins", "jeuZero"];

export function Racetrack({ selectedChip, neighborRange, interactive, onCallBet, onNeighbors }: RacetrackProps) {
  const [n, setN] = useState(neighborRange.default);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-white/45">Racetrack</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/45">Neighbours ±</span>
          {Array.from({ length: neighborRange.max - neighborRange.min + 1 }, (_, i) => neighborRange.min + i).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setN(v)}
              aria-pressed={v === n}
              className={`focus-ring h-6 w-6 rounded-md border text-[11px] font-bold ${
                v === n ? "border-[var(--gold-2)] bg-[var(--gold-2)] text-[#2a1d05]" : "border-white/20 text-white/70 hover:bg-white/10"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 100 56" className="w-full" role="group" aria-label="Racetrack numbers">
        <ellipse cx={CX} cy={CY} rx={RX + 4} ry={RY + 5} fill="none" stroke="#3a2f12" strokeWidth={0.8} />
        <ellipse cx={CX} cy={CY} rx={RX - 5} ry={RY - 5} fill="none" stroke="#ffffff14" strokeWidth={0.6} />
        {WHEEL_ORDER.map((num, i) => {
          const p = pointOnCircleEllipse(i * SECTOR);
          return (
            <g
              key={num}
              role="button"
              tabIndex={interactive ? 0 : -1}
              onClick={() => interactive && onNeighbors(num, n)}
              style={{ cursor: interactive ? "pointer" : "default" }}
            >
              <circle cx={p.x} cy={p.y} r={3.2} fill={POCKET_FILL[colorOf(num)]} stroke="#0c0f17" strokeWidth={0.4} />
              <text x={p.x} y={p.y} fill="#fff" fontSize={2.6} fontWeight={700} textAnchor="middle" dominantBaseline="central">
                {num}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CALL_ORDER.map((id) => {
          const def = CALL_BET_DEFS[id];
          const cost = def.chipCount * selectedChip;
          return (
            <button
              key={id}
              type="button"
              disabled={!interactive}
              onClick={() => onCallBet(id)}
              className="focus-ring rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-left transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="text-[10px] font-bold uppercase tracking-tight text-[var(--gold-2)]">{def.label}</div>
              <div className="text-[9px] text-white/55">
                {def.chipCount} × {formatChips(selectedChip)} = <span className="tabular-nums text-white/80">{formatChips(cost)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function pointOnCircleEllipse(deg: number): { x: number; y: number } {
  // reuse the angle convention (0 = top, clockwise) but on an ellipse
  const unit = pointOnCircle(0, 0, 1, deg);
  return { x: CX + unit.x * RX, y: CY + unit.y * RY };
}
