// components/roulette/RouletteWheelFallback.tsx
// Pure CSS/SVG 2.5D wheel — the fallback when WebGL is unavailable, 3D init fails, or reduced motion is
// active (§14). Same rotor/ball landing math as the 3D path (whole turns → pockets at angleOf(n); ball
// settles to angleOf(landedNumber)); never reads the result from an angle.
import { useCallback, useEffect, useRef, useState } from "react";
import { EASING } from "./motion";
import type { RouletteAnimationMode } from "./animationMode";
import { WHEEL_GEOMETRY, angleOf } from "./wheelGeometry";

const G = WHEEL_GEOMETRY;
const RIM_R = G.ballR;
const REST_R = G.labelR + 1.5;
const POCKET_FILL: Record<string, string> = { red: "var(--rl-red)", black: "var(--rl-black)", green: "var(--rl-zero)" };
const nowMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
const reqPaint = (cb: FrameRequestCallback): number =>
  typeof window !== "undefined" && window.requestAnimationFrame
    ? window.requestAnimationFrame(cb)
    : (window.setTimeout(() => cb(nowMs()), 16) as unknown as number);
const cancelP = (id: number): void => {
  if (typeof window !== "undefined" && window.cancelAnimationFrame) window.cancelAnimationFrame(id);
  else window.clearTimeout(id);
};

type Phase = "idle" | "spin" | "land";

export interface RouletteWheelFallbackProps {
  activeEventType: string | null;
  landedNumber: number | null;
  resultRevealed: boolean;
  dollyNumber: number | null;
  mode: RouletteAnimationMode;
  spinMs: number;
  landMs: number;
  /** Id of the live BALL_LAND event — echoed back when the CSS landing finishes (§17). */
  landEventId?: string | null;
  /** Called ONCE when the (time-based) landing completes AND a frame painted, so the queue can ack (§17). */
  onLandingComplete?: (eventId: string) => void;
  /** performance.now() when BALL_LAND started — a mid-landing mount only waits the REMAINING time. */
  landingStartedAtMs?: number | null;
  /** Queue's force-finalize request: snap to final and report on the next paintable frame (§17). */
  forceFinalizeLanding?: boolean;
}

const SPIN_TURNS: Record<RouletteAnimationMode, number> = { standard: 5, full: 9, reduced: 1 };
const LAND_TURNS: Record<RouletteAnimationMode, number> = { standard: 2, full: 4, reduced: 1 };

function settleBelow(ceil: number, targetMod: number): number {
  const rem = (((ceil - targetMod) % 360) + 360) % 360;
  return ceil - rem;
}

export function RouletteWheelFallback({ activeEventType, landedNumber, resultRevealed, dollyNumber, mode, spinMs, landMs, landEventId = null, onLandingComplete, landingStartedAtMs = null, forceFinalizeLanding = false }: RouletteWheelFallbackProps) {
  const wheelDegRef = useRef(0);
  const ballDegRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");

  // landing-complete handshake (§17): the fallback settles over its REMAINING time, then reports on the
  // next paintable frame (rAF — paused while hidden) so the banner can never precede the settled ball.
  // Refs avoid stale closures; once per id. Both the timer and the rAF are cleared on event/id change
  // and unmount.
  const onLandingCompleteRef = useRef(onLandingComplete);
  onLandingCompleteRef.current = onLandingComplete;
  const landTimerRef = useRef<number | null>(null);
  const landRafRef = useRef<number | null>(null);
  const reportedLandRef = useRef<string | null>(null);

  const clearLandReport = useCallback(() => {
    if (landTimerRef.current !== null) {
      window.clearTimeout(landTimerRef.current);
      landTimerRef.current = null;
    }
    if (landRafRef.current !== null) {
      cancelP(landRafRef.current);
      landRafRef.current = null;
    }
  }, []);

  const scheduleLandReport = useCallback(
    (eid: string | null, delayMs: number) => {
      clearLandReport();
      landTimerRef.current = window.setTimeout(() => {
        landTimerRef.current = null;
        landRafRef.current = reqPaint(() => {
          landRafRef.current = null;
          if (eid && reportedLandRef.current !== eid) {
            reportedLandRef.current = eid;
            onLandingCompleteRef.current?.(eid);
          }
        });
      }, Math.max(0, delayMs));
    },
    [clearLandReport],
  );

  const [wheelDeg, setWheelDeg] = useState(0);
  const [ballDeg, setBallDeg] = useState(0);
  const [ballR, setBallR] = useState(RIM_R);
  const [trans, setTrans] = useState({ ms: 0, ease: "linear" });
  const [ballVisible, setBallVisible] = useState(false);

  useEffect(() => {
    if (activeEventType === "SPIN_START" && phaseRef.current !== "spin") {
      phaseRef.current = "spin";
      setBallVisible(true);
      wheelDegRef.current += SPIN_TURNS[mode] * 360;
      ballDegRef.current -= (SPIN_TURNS[mode] + 2) * 360;
      setWheelDeg(wheelDegRef.current);
      setBallDeg(ballDegRef.current);
      setBallR(RIM_R);
      setTrans({ ms: Math.max(80, spinMs), ease: EASING.spinUp });
    } else if (activeEventType === "BALL_LAND" && landedNumber != null && phaseRef.current !== "land") {
      phaseRef.current = "land";
      setBallVisible(true);
      wheelDegRef.current += LAND_TURNS[mode] * 360;
      const ceil = ballDegRef.current - LAND_TURNS[mode] * 360;
      ballDegRef.current = settleBelow(ceil, angleOf(landedNumber));
      setWheelDeg(wheelDegRef.current);
      setBallDeg(ballDegRef.current);
      setBallR(REST_R);
      // inherit elapsed time: a mid-landing mount (3D→fallback switch) only waits the REMAINDER. If the
      // nominal duration is already spent (or force-finalize is requested), snap to final immediately.
      const nominal = Math.max(80, landMs);
      const started = landingStartedAtMs ?? nowMs();
      const remaining = forceFinalizeLanding ? 0 : Math.max(0, nominal - (nowMs() - started));
      setTrans({ ms: remaining, ease: remaining > 0 ? EASING.decel : "linear" });
      scheduleLandReport(landEventId, remaining);
    } else if (activeEventType === "NO_MORE_BETS") {
      phaseRef.current = "idle";
    }
  }, [activeEventType, landedNumber, mode, spinMs, landMs, landEventId, landingStartedAtMs, forceFinalizeLanding, scheduleLandReport]);

  // Force-finalize while already settling (the queue's deadline passed): snap to final, report next paint.
  useEffect(() => {
    if (forceFinalizeLanding && activeEventType === "BALL_LAND" && phaseRef.current === "land") {
      setTrans({ ms: 0, ease: "linear" });
      setBallR(REST_R);
      scheduleLandReport(landEventId, 0);
    }
  }, [forceFinalizeLanding, activeEventType, landEventId, scheduleLandReport]);

  // Clear any pending land report when we leave BALL_LAND, when the event id changes, and on unmount —
  // so a stale event id is never reported and no timer/rAF leaks. (React runs cleanups before the next
  // commit's setups, so the report scheduled for the live BALL_LAND is never cancelled prematurely.)
  useEffect(() => clearLandReport, [activeEventType, landEventId, clearLandReport]);

  const winner = resultRevealed ? dollyNumber ?? landedNumber : null;
  const transition = `transform ${trans.ms}ms ${trans.ease}`;
  const rimW = G.outerR * 0.14;

  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full" role="img" aria-label="Roulette wheel" style={{ filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.5))" }}>
      <defs>
        <radialGradient id="rlWoodBowl" cx="0.5" cy="0.42" r="0.65">
          <stop offset="0" stopColor="#52331D" />
          <stop offset="0.7" stopColor="#33200F" />
          <stop offset="1" stopColor="#1C1108" />
        </radialGradient>
        <radialGradient id="rlHubGold" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#FFF3B0" />
          <stop offset="0.45" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#8C6B1F" />
        </radialGradient>
        <radialGradient id="rlBall" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#C9CDD6" />
          <stop offset="1" stopColor="#6E7480" />
        </radialGradient>
        <radialGradient id="rlCone" cx="0.5" cy="0.42" r="0.6">
          <stop offset="0" stopColor="#241608" />
          <stop offset="1" stopColor="#0E0903" />
        </radialGradient>
        <linearGradient id="rlRimMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF3B0" />
          <stop offset="0.3" stopColor="#F6E27A" />
          <stop offset="0.55" stopColor="#D4AF37" />
          <stop offset="0.8" stopColor="#9A7A2A" />
          <stop offset="1" stopColor="#F1DD8C" />
        </linearGradient>
      </defs>
      <ellipse cx={G.cx} cy={G.cy + G.outerR - 4} rx={G.outerR * 0.82} ry={6} fill="#000" opacity={0.4} />
      <circle cx={G.cx} cy={G.cy} r={G.outerR} fill="url(#rlWoodBowl)" />
      <circle cx={G.cx} cy={G.cy} r={G.outerR} fill="none" stroke="#160d05" strokeWidth={0.6} />
      <circle cx={G.cx} cy={G.cy + 1.2} r={G.ringR + 2.2} fill="#120B06" opacity={0.85} />
      <circle cx={G.cx} cy={G.cy} r={G.outerR - rimW / 2} fill="none" stroke="url(#rlRimMetal)" strokeWidth={rimW} />
      <circle cx={G.cx} cy={G.cy} r={G.outerR - rimW + 0.4} fill="none" stroke="#fff6d0" strokeWidth={0.5} opacity={0.5} />
      <circle cx={G.cx} cy={G.cy} r={G.outerR - 0.6} fill="none" stroke="#6b5212" strokeWidth={0.5} opacity={0.6} />
      <g style={{ transform: `rotate(${wheelDeg}deg)`, transformBox: "view-box", transformOrigin: "50px 50px", transition }}>
        {G.sectors.map((s) => {
          const isWin = winner === s.n;
          return (
            <g key={s.n}>
              <path d={s.path} fill={POCKET_FILL[s.color]} stroke={isWin ? "#ffe9a8" : "#0a0d14"} strokeWidth={isWin ? 1.4 : 0.5} style={isWin ? { filter: "drop-shadow(0 0 2.6px #ffd86b)" } : undefined} />
              <text x={s.label.x} y={s.label.y} fill="var(--rl-ink)" fontSize={3.2} fontWeight={700} fontFamily="Georgia, serif" textAnchor="middle" dominantBaseline="central" transform={`rotate(${s.labelRotation} ${s.label.x} ${s.label.y})`}>
                {s.n}
              </text>
            </g>
          );
        })}
      </g>
      <circle cx={G.cx} cy={G.cy} r={G.pocketR} fill="url(#rlCone)" />
      <circle cx={G.cx} cy={G.cy} r={G.pocketR - 2} fill="none" stroke="url(#rlRimMetal)" strokeWidth={0.7} opacity={0.7} />
      <circle cx={G.cx} cy={G.cy} r={G.hubR + 1.5} fill="none" stroke="url(#rlRimMetal)" strokeWidth={0.7} opacity={0.7} />
      <circle cx={G.cx} cy={G.cy} r={G.hubR} fill="url(#rlHubGold)" stroke="#7a5e1f" strokeWidth={0.6} />
      <g stroke="#8c6b1f" strokeWidth={1.4} strokeLinecap="round" opacity={0.85}>
        <line x1={G.cx - G.hubR} y1={G.cy} x2={G.cx + G.hubR} y2={G.cy} />
        <line x1={G.cx} y1={G.cy - G.hubR} x2={G.cx} y2={G.cy + G.hubR} />
      </g>
      <circle cx={G.cx} cy={G.cy} r={G.hubR * 0.42} fill="url(#rlHubGold)" stroke="#7a5e1f" strokeWidth={0.4} />
      <ellipse cx={G.cx - 1.6} cy={G.cy - 2.4} rx={3.4} ry={2} fill="#fff" opacity={0.5} />
      <g style={{ transform: `rotate(${ballDeg}deg)`, transformBox: "view-box", transformOrigin: "50px 50px", transition, opacity: ballVisible ? 1 : 0 }}>
        <circle cx={G.cx} cy={G.cy - ballR} r={2.4} fill="url(#rlBall)" style={{ transition: `cy ${trans.ms}ms ${trans.ease}`, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))" }} />
      </g>
      <ellipse cx={G.cx - 9} cy={G.cy - 12} rx={26} ry={15} fill="#fff" opacity={0.06} pointerEvents="none" transform={`rotate(-24 ${G.cx} ${G.cy})`} />
    </svg>
  );
}
