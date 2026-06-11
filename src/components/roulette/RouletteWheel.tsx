// components/roulette/RouletteWheel.tsx
// 2.5D SVG wheel + ball (addendum §9–§11). Pure CSS/SVG — no Three.js/WebGL/framer-motion.
//
// Landing correctness (§11.1): the wheel only ever rotates whole turns, so pockets always rest at
// angleOf(n); the ball then settles to angleOf(landedNumber). We derive the landing ANGLE from the
// result — never the result from an angle. resultRevealed gates the winner GLOW + dolly, never the
// physical landing (the ball dropping IS the reveal).
import { useEffect, useRef, useState } from "react";
import { EASING } from "./motion";
import type { RouletteAnimationMode, RouletteVisualFocus } from "./animationMode";
import { POCKET_FILL } from "./rouletteLabels";
import { WHEEL_GEOMETRY, angleOf } from "./wheelGeometry";

const G = WHEEL_GEOMETRY;
const RIM_R = G.ballR; // ball orbit while spinning (just inside the rim)
const REST_R = G.labelR + 1.5; // ball resting radius (inside the number ring)

type Phase = "idle" | "spin" | "land";

interface RouletteWheelProps {
  activeEventType: string | null;
  landedNumber: number | null;
  resultRevealed: boolean;
  dollyNumber: number | null;
  visualFocus: RouletteVisualFocus;
  mode: RouletteAnimationMode;
  /** Event gate durations (ms) so the wheel/ball transitions match the queue timing. */
  spinMs: number;
  landMs: number;
}

const SPIN_TURNS: Record<RouletteAnimationMode, number> = { standard: 5, full: 9, reduced: 1 };
const LAND_TURNS: Record<RouletteAnimationMode, number> = { standard: 2, full: 4, reduced: 1 };

/** Largest value ≤ ceil that is ≡ target (mod 360). Lets the ball keep going counter-clockwise. */
function settleBelow(ceil: number, targetMod: number): number {
  const rem = (((ceil - targetMod) % 360) + 360) % 360;
  return ceil - rem;
}

export function RouletteWheel({
  activeEventType,
  landedNumber,
  resultRevealed,
  dollyNumber,
  visualFocus,
  mode,
  spinMs,
  landMs,
}: RouletteWheelProps) {
  const wheelDegRef = useRef(0);
  const ballDegRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");

  const [wheelDeg, setWheelDeg] = useState(0);
  const [ballDeg, setBallDeg] = useState(0);
  const [ballR, setBallR] = useState(RIM_R);
  const [trans, setTrans] = useState({ ms: 0, ease: "linear" });
  const [ballVisible, setBallVisible] = useState(false);

  useEffect(() => {
    if (activeEventType === "SPIN_START" && phaseRef.current !== "spin") {
      phaseRef.current = "spin";
      setBallVisible(true);
      wheelDegRef.current += SPIN_TURNS[mode] * 360; // whole turns → pockets stay at base angle
      ballDegRef.current -= (SPIN_TURNS[mode] + 2) * 360; // counter-clockwise
      setWheelDeg(wheelDegRef.current);
      setBallDeg(ballDegRef.current);
      setBallR(RIM_R);
      setTrans({ ms: Math.max(80, spinMs), ease: EASING.spinUp });
    } else if (activeEventType === "BALL_LAND" && landedNumber != null && phaseRef.current !== "land") {
      phaseRef.current = "land";
      setBallVisible(true);
      wheelDegRef.current += LAND_TURNS[mode] * 360; // still whole turns
      const ceil = ballDegRef.current - LAND_TURNS[mode] * 360;
      ballDegRef.current = settleBelow(ceil, angleOf(landedNumber));
      setWheelDeg(wheelDegRef.current);
      setBallDeg(ballDegRef.current);
      setBallR(REST_R);
      setTrans({ ms: Math.max(80, landMs), ease: EASING.decel });
    } else if (activeEventType === "NO_MORE_BETS") {
      phaseRef.current = "idle";
    }
  }, [activeEventType, landedNumber, mode, spinMs, landMs]);

  const winner = resultRevealed ? (dollyNumber ?? landedNumber) : null;
  const transition = `transform ${trans.ms}ms ${trans.ease}`;

  return (
    <div className="roulette-wheel-stage" data-focus={visualFocus} data-mode={mode}>
      <div className="roulette-wheel-tilt">
        <svg viewBox="0 0 100 100" className="roulette-wheel-svg" role="img" aria-label="Roulette wheel">
          <defs>
            <radialGradient id="rouletteHub" cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#f6e3a1" />
              <stop offset="55%" stopColor="#caa23c" />
              <stop offset="100%" stopColor="#6c531a" />
            </radialGradient>
            <radialGradient id="rouletteBall" cx="38%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#dfe4ec" />
              <stop offset="100%" stopColor="#8a93a4" />
            </radialGradient>
          </defs>

          {/* metal rim */}
          <circle cx={G.cx} cy={G.cy} r={G.outerR - 0.5} fill="none" stroke="#caa23c" strokeWidth={3} />
          <circle cx={G.cx} cy={G.cy} r={G.ringR + 1.6} fill="none" stroke="#3a2f12" strokeWidth={1.2} />

          {/* rotating wheel body */}
          <g
            style={{ transform: `rotate(${wheelDeg}deg)`, transformBox: "view-box", transformOrigin: "50px 50px", transition }}
          >
            {G.sectors.map((s) => {
              const isWin = winner === s.n;
              return (
                <g key={s.n}>
                  <path
                    d={s.path}
                    fill={POCKET_FILL[s.color]}
                    stroke={isWin ? "#ffe9a8" : "#0c0f17"}
                    strokeWidth={isWin ? 1.4 : 0.4}
                    style={isWin ? { filter: "drop-shadow(0 0 2.4px #ffd86b)" } : undefined}
                  />
                  <text
                    x={s.label.x}
                    y={s.label.y}
                    fill={s.color === "black" ? "#f0e2b8" : "#ffffff"}
                    fontSize={2.7}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${s.labelRotation} ${s.label.x} ${s.label.y})`}
                  >
                    {s.n}
                  </text>
                </g>
              );
            })}
            {/* gold hub */}
            <circle cx={G.cx} cy={G.cy} r={G.hubR} fill="url(#rouletteHub)" stroke="#7a5e1f" strokeWidth={0.6} />
            <circle cx={G.cx} cy={G.cy} r={G.hubR * 0.5} fill="none" stroke="#fff3c9" strokeWidth={0.5} opacity={0.6} />
          </g>

          {/* ball — separate layer so its angle is absolute */}
          <g
            style={{ transform: `rotate(${ballDeg}deg)`, transformBox: "view-box", transformOrigin: "50px 50px", transition, opacity: ballVisible ? 1 : 0 }}
          >
            <circle cx={G.cx} cy={G.cy - ballR} r={2.4} fill="url(#rouletteBall)" style={{ transition: `cy ${trans.ms}ms ${trans.ease}`, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))" }} />
          </g>
        </svg>
      </div>
    </div>
  );
}
