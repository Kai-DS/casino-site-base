// components/roulette/RouletteWheel3D.tsx
// Real 3D roulette wheel (Roulette 3D Wheel Upgrade). Three.js via react-three-fiber, procedural
// geometry + an env map built from Lightformers (no network). DISPLAY ONLY: it reads the AnimationEvent
// stream and lands the ball on result.number; it never decides the result, holds an ack, or bypasses
// resultRevealed. The rotor turns whole turns (identity at rest) so the ball settling at
// angleOf(landedNumber) sits exactly on that pocket (§13).
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import type { RouletteAnimationMode } from "./animationMode";
import { MAT, pocketMat } from "./wheel3dMaterials";
import { POCKET_DEFS, R, SECTOR_DEG, SECTOR_RAD, angleOf, numberTexture, posAt } from "./wheel3dGeometry";
import { WheelAnimator } from "./wheel3dAnimation";

export interface RouletteWheel3DProps {
  activeEventType: string | null;
  landedNumber: number | null;
  resultRevealed: boolean;
  dollyNumber: number | null;
  mode: RouletteAnimationMode;
  spinMs: number;
  landMs: number;
  /** Long-mode cinematic close-up (camera dolly in). */
  closeUp: boolean;
}

const MID_R = (R.pocketOuter + R.pocketInner) / 2;
const CAM_WIDE = new THREE.Vector3(0, 8.6, 12.4);
const CAM_CLOSE = new THREE.Vector3(0, 6.2, 9.0);
const deg = THREE.MathUtils.degToRad;

export function RouletteWheel3D(props: RouletteWheel3DProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: CAM_WIDE.toArray(), fov: 34 }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[5, 9, 4]} intensity={2.0} color="#fff4d6" />
      <directionalLight position={[-6, 4, -3]} intensity={0.7} color="#bcd0ff" />
      <pointLight position={[0, 6, 3]} intensity={1.1} />
      {/* procedural env map (no external HDR) for the metal reflections */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2.2} position={[0, 6, -3]} scale={[8, 8, 1]} color="#fff3c0" />
        <Lightformer intensity={1.1} position={[-5, 2, 4]} scale={[5, 5, 1]} color="#ffffff" />
        <Lightformer intensity={0.8} position={[5, 3, 3]} scale={[4, 4, 1]} color="#ffe9b0" />
      </Environment>
      <WheelScene {...props} />
    </Canvas>
  );
}

function WheelScene({ activeEventType, landedNumber, resultRevealed, dollyNumber, mode, spinMs, landMs, closeUp }: RouletteWheel3DProps) {
  const animRef = useRef<WheelAnimator>(new WheelAnimator());
  const rotorRef = useRef<THREE.Group>(null);
  const ballRef = useRef<THREE.Mesh>(null);
  const phaseRef = useRef<"idle" | "spin" | "land">("idle");
  const [ballVisible, setBallVisible] = useState(false);

  useEffect(() => {
    const now = performance.now();
    const anim = animRef.current;
    if (activeEventType === "SPIN_START" && phaseRef.current !== "spin") {
      phaseRef.current = "spin";
      setBallVisible(true);
      anim.startSpin(mode, spinMs, now);
    } else if (activeEventType === "BALL_LAND" && landedNumber != null && phaseRef.current !== "land") {
      phaseRef.current = "land";
      anim.startLand(landedNumber, mode, landMs, now);
    } else if (activeEventType === "NO_MORE_BETS") {
      phaseRef.current = "idle";
      anim.reset();
    }
  }, [activeEventType, landedNumber, mode, spinMs, landMs]);

  useFrame(({ camera }) => {
    const s = animRef.current.sample(performance.now());
    if (rotorRef.current) rotorRef.current.rotation.y = deg(s.rotorDeg);
    if (ballRef.current) {
      const [x, y, z] = posAt(s.ballDeg, s.ballR, s.ballY);
      ballRef.current.position.set(x, y, z);
    }
    camera.position.lerp(closeUp ? CAM_CLOSE : CAM_WIDE, 0.05);
    camera.lookAt(0, 0.2, 0);
  });

  const winner = resultRevealed ? dollyNumber ?? landedNumber : null;

  return (
    <group rotation={[0, 0, 0]}>
      {/* ── static structure ── */}
      {/* wooden bowl wall */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[R.bowlOuter, R.bowlOuter + 0.25, 0.7, 72, 1, true]} />
        <meshStandardMaterial {...MAT.wood} side={THREE.DoubleSide} />
      </mesh>
      {/* bowl floor / outer felt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, R.bowlFloorY, 0]}>
        <circleGeometry args={[R.bowlOuter, 72]} />
        <meshStandardMaterial {...MAT.woodDark} />
      </mesh>
      {/* gold rim */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <torusGeometry args={[R.rimCenter, R.rimTube, 20, 90]} />
        <meshStandardMaterial {...MAT.gold} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.16, 0]}>
        <torusGeometry args={[R.rimCenter, R.rimTube * 0.45, 16, 90]} />
        <meshStandardMaterial {...MAT.goldHi} />
      </mesh>
      {/* pocket-band base (dark recessed ring) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, R.pocketFloorY - 0.04, 0]}>
        <ringGeometry args={[R.pocketInner - 0.05, R.pocketOuter + 0.05, 80]} />
        <meshStandardMaterial {...MAT.woodDark} />
      </mesh>

      {/* ── rotor (spins) ── */}
      <group ref={rotorRef}>
        <Pockets />
        <Frets />
        <Numbers />
        {/* cone + hub turret */}
        <mesh position={[0, 0.28, 0]}>
          <coneGeometry args={[R.coneR, R.coneH, 56]} />
          <meshStandardMaterial {...MAT.cone} />
        </mesh>
        <mesh position={[0, R.coneH * 0.55, 0]}>
          <cylinderGeometry args={[R.hubR, R.hubR * 1.15, 0.5, 40]} />
          <meshStandardMaterial {...MAT.gold} />
        </mesh>
        <mesh position={[0, R.coneH * 0.55 + 0.34, 0]}>
          <sphereGeometry args={[R.spindleR * 1.6, 24, 24]} />
          <meshStandardMaterial {...MAT.goldHi} />
        </mesh>
        {/* cross handles */}
        {[0, 90].map((a) => (
          <mesh key={a} position={[0, R.coneH * 0.55 + 0.18, 0]} rotation={[0, deg(a), 0]}>
            <boxGeometry args={[R.hubR * 2.3, 0.07, 0.12]} />
            <meshStandardMaterial {...MAT.goldLo} />
          </mesh>
        ))}
      </group>

      {/* ── ball ── */}
      <mesh ref={ballRef} visible={ballVisible} position={[0, R.ballSpinY, -R.ballOrbitR]} castShadow>
        <sphereGeometry args={[R.ballR, 28, 28]} />
        <meshStandardMaterial {...MAT.ball} />
      </mesh>

      {/* ── winner highlight (reveal-gated) ── */}
      {winner != null && (
        <mesh position={posAt(angleOf(winner), MID_R, R.pocketFloorY + 0.12)} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.66, 28]} />
          <meshStandardMaterial color="#ffe9a8" emissive="#f6d76a" emissiveIntensity={1.4} transparent opacity={0.92} />
        </mesh>
      )}

      {/* contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, R.bowlFloorY - 0.05, 0]}>
        <circleGeometry args={[R.bowlOuter * 1.05, 48]} />
        <meshBasicMaterial color="#000" transparent opacity={0.32} />
      </mesh>
    </group>
  );
}

// ── rotor children (memoised) ────────────────────────────────────────────────
function Pockets() {
  const arcW = MID_R * SECTOR_RAD * 0.96;
  const radialLen = R.pocketOuter - R.pocketInner;
  return (
    <group>
      {POCKET_DEFS.map((p) => (
        <mesh key={p.n} position={posAt(p.angle, MID_R, R.pocketFloorY)} rotation={[0, deg(180 - p.angle), 0]}>
          <boxGeometry args={[arcW, 0.1, radialLen]} />
          <meshStandardMaterial {...pocketMat(p.color)} />
        </mesh>
      ))}
    </group>
  );
}

function Frets() {
  return (
    <group>
      {POCKET_DEFS.map((p) => {
        const a = p.angle - SECTOR_DEG / 2; // boundary
        return (
          <mesh key={p.n} position={posAt(a, MID_R, R.pocketFloorY + R.fretH / 2 - 0.05)} rotation={[0, deg(180 - a), 0]}>
            <boxGeometry args={[0.05, R.fretH, R.pocketOuter - R.pocketInner + 0.1]} />
            <meshStandardMaterial {...MAT.gold} />
          </mesh>
        );
      })}
    </group>
  );
}

function Numbers() {
  const planes = useMemo(() => POCKET_DEFS.map((p) => ({ ...p, tex: numberTexture(p.n) })), []);
  return (
    <group>
      {planes.map((p) => (
        <mesh key={p.n} position={posAt(p.angle, R.labelR, R.pocketFloorY + 0.07)} rotation={[-Math.PI / 2, 0, deg(-p.angle)]}>
          <planeGeometry args={[0.62, 0.62]} />
          <meshBasicMaterial map={p.tex} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
