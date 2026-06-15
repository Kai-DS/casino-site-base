// components/roulette/RouletteWheel3D.tsx
// The cinematic 3D European roulette wheel. Three.js via react-three-fiber, fully procedural geometry +
// an env map built from Lightformers (no network). DISPLAY ONLY: it reads the AnimationEvent stream and
// lands the ball on result.number; it never decides the result, holds an ack, or bypasses resultRevealed.
// The rotor turns WHOLE turns (identity at rest) so the ball settling at angleOf(landedNumber) sits
// exactly inside that pocket (§5/§13). Per-frame transforms write straight to refs — no React state in
// the loop. All canvas textures / hand-built geometry are disposed on unmount (§20).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import type { RouletteAnimationMode } from "./animationMode";
import { MAT, BALL_MAT } from "./wheel3dMaterials";
import {
  R,
  POCKET_DEFS,
  FRET_ANGLES,
  DEFLECTOR_ANGLES,
  angleOf,
  posAt,
  bowlProfile,
  buildFloorGeometry,
  buildFretGeometry,
  buildPocketFrameGeometry,
  buildNumberTexture,
  buildWoodTexture,
  buildShadowTexture,
  rotationYForWheelAngle,
  type PocketDef,
} from "./wheel3dGeometry";
import { WheelAnimator } from "./wheel3dAnimation";
import { WHEEL_CAMERA_POSITION, WHEEL_CAMERA_LOOK_AT, WHEEL_CAMERA_FOV } from "./wheel3dCamera";

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
  /** Id of the live BALL_LAND event (null otherwise) — echoed back via onLandingComplete (§17). */
  landEventId?: string | null;
  /** Called ONCE when the ball has settled AND a frame has painted, so the queue can ack BALL_LAND (§17). */
  onLandingComplete?: (eventId: string) => void;
  /** Accepted for prop symmetry with the fallback; the 3D runs its own clock and ignores it. */
  landingStartedAtMs?: number | null;
  /** Queue's force-finalize request: snap the landing to its final state, then report next paint (§17). */
  forceFinalizeLanding?: boolean;
}

// Resources this hook OWNS and disposes itself. Meshes that use them are marked dispose={null} so R3F
// never also disposes them (no double-dispose). Everything else in the scene (JSX geometry/material,
// Drei internals) is R3F-owned and auto-disposed — and a material's .map is NEVER auto-disposed, so the
// canvas textures below are disposed solely here. See the ownership table in the change report (§6).
interface WheelResources {
  bowlGeom: THREE.LatheGeometry;
  bowlMat: THREE.MeshStandardMaterial;
  floorGeom: THREE.BufferGeometry;
  floorMat: THREE.MeshStandardMaterial;
  fretGeom: THREE.BufferGeometry;
  fretMat: THREE.MeshStandardMaterial;
  pocketFrameGeom: THREE.BufferGeometry;
  woodTex: THREE.CanvasTexture;
  shadowTex: THREE.CanvasTexture;
  numbers: ReadonlyArray<PocketDef & { tex: THREE.CanvasTexture }>;
}

/**
 * Build all hook-owned GPU/Three.js resources in a COMMIT-phase effect (never during render), and
 * dispose them in the effect cleanup (§20 / audit #2). This survives Strict Mode (mount → cleanup →
 * mount disposes the throwaway set and builds a fresh one) and interrupted/concurrent renders (an
 * uncommitted render never allocates a LatheGeometry / CanvasTexture / material, so nothing can leak
 * past cleanup). Until it resolves the scene renders nothing — a single blank frame on first mount.
 */
export function useWheelResources(): WheelResources | null {
  const [res, setRes] = useState<WheelResources | null>(null);
  useEffect(() => {
    const woodTex = buildWoodTexture();
    const built: WheelResources = {
      bowlGeom: new THREE.LatheGeometry(bowlProfile(), 144),
      bowlMat: new THREE.MeshStandardMaterial({ ...MAT.wood, map: woodTex, side: THREE.DoubleSide }),
      floorGeom: buildFloorGeometry(),
      floorMat: new THREE.MeshStandardMaterial({ ...MAT.pocket, vertexColors: true, side: THREE.DoubleSide }),
      fretGeom: buildFretGeometry(),
      fretMat: new THREE.MeshStandardMaterial({ ...MAT.gold, flatShading: true }),
      pocketFrameGeom: buildPocketFrameGeometry(),
      woodTex,
      shadowTex: buildShadowTexture(),
      numbers: POCKET_DEFS.map((p) => ({ ...p, tex: buildNumberTexture(p.n) })),
    };
    setRes(built);
    return () => {
      built.bowlGeom.dispose();
      built.bowlMat.dispose();
      built.floorGeom.dispose();
      built.floorMat.dispose();
      built.fretGeom.dispose();
      built.fretMat.dispose();
      built.pocketFrameGeom.dispose();
      built.woodTex.dispose();
      built.shadowTex.dispose();
      built.numbers.forEach((p) => p.tex.dispose());
    };
  }, []);
  return res;
}

const deg = THREE.MathUtils.degToRad;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// camera framing lives in ./wheel3dCamera — one fixed 3/4 view shared by EVERY mode (no per-mode dolly).

export function RouletteWheel3D(props: RouletteWheel3DProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows={false}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: WHEEL_CAMERA_POSITION.toArray(), fov: WHEEL_CAMERA_FOV, near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.06;
      }}
      style={{ width: "100%", height: "100%" }}
    >
      {/* studio key / fill / rim — restrained, lets material + form carry the luxury (§15) */}
      <ambientLight intensity={0.46} />
      <directionalLight position={[6, 10, 5]} intensity={1.7} color="#fff2d2" />
      <directionalLight position={[-7, 5, -2]} intensity={0.55} color="#bcd2ff" />
      <directionalLight position={[0, 5.5, -9]} intensity={0.8} color="#ffe6b0" />
      {/* soft downlight so the recessed pockets read their colour */}
      <pointLight position={[0, 7, 0.5]} intensity={0.7} distance={22} decay={1.4} color="#fff4dc" />
      <pointLight position={[0, 4, 2.5]} intensity={0.4} color="#fff6e8" />
      {/* procedural env map (no external HDR) for the metal reflections */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2.4} position={[0, 6, -3]} scale={[9, 9, 1]} color="#fff3c0" />
        <Lightformer intensity={1.2} position={[-5, 2, 4]} scale={[5, 6, 1]} color="#ffffff" />
        <Lightformer intensity={0.9} position={[5, 3, 3]} scale={[4, 5, 1]} color="#ffe9b0" />
        <Lightformer intensity={0.6} position={[0, -4, 2]} scale={[8, 8, 1]} color="#6a5230" />
      </Environment>
      <WheelScene {...props} />
    </Canvas>
  );
}

function WheelScene({ activeEventType, landedNumber, resultRevealed, dollyNumber, mode, spinMs, landMs, landEventId, onLandingComplete, forceFinalizeLanding }: RouletteWheel3DProps) {
  // NOTE: `closeUp` (and `mode`'s camera influence) are intentionally NOT read here — the camera framing
  // is fixed and identical for every mode (see ./wheel3dCamera). Only the BALL's timing/motion/density
  // differ by mode. `closeUp` stays on the props contract but has no 3D-camera effect.
  const animRef = useRef<WheelAnimator | null>(null);
  if (animRef.current === null) animRef.current = new WheelAnimator();
  const rotorRef = useRef<THREE.Group>(null);
  const ballRef = useRef<THREE.Mesh>(null);
  const ballShadowRef = useRef<THREE.Mesh>(null);
  const winnerGlowRef = useRef<THREE.Mesh>(null);
  const phaseRef = useRef<"idle" | "spin" | "land">("idle");
  const [ballVisible, setBallVisible] = useState(false);

  // reusable scratch vector — useFrame must allocate nothing (audit #3). Per-instance (not module scope)
  // so multiple Canvases can't clobber each other's frame state. Only the ball's radial axis needs one
  // now; the camera is fixed (no per-frame interpolation), so it needs no scratch vectors.
  const radialRef = useRef(new THREE.Vector3());

  // landing-complete handshake (§17 / audit #1): echo the BALL_LAND id back ONCE, the frame the ball
  // actually settles. Refs avoid stale closures and keep it idempotent per event id.
  const onLandingCompleteRef = useRef(onLandingComplete);
  onLandingCompleteRef.current = onLandingComplete;
  const landEventIdRef = useRef(landEventId);
  landEventIdRef.current = landEventId;
  const forceFinalizeRef = useRef(forceFinalizeLanding);
  forceFinalizeRef.current = forceFinalizeLanding;
  const finalAppliedRef = useRef<string | null>(null); // final transform applied & painted for this id
  const reportedLandRef = useRef<string | null>(null);

  const res = useWheelResources();

  useEffect(() => {
    const now = performance.now();
    const anim = animRef.current!;
    if (activeEventType === "SPIN_START" && phaseRef.current !== "spin") {
      phaseRef.current = "spin";
      setBallVisible(true);
      anim.startSpin(mode, spinMs, now);
    } else if (activeEventType === "BALL_LAND" && landedNumber != null && phaseRef.current !== "land") {
      phaseRef.current = "land";
      anim.startLand(landedNumber, mode, landMs, now);
    } else if (activeEventType === "NO_MORE_BETS") {
      phaseRef.current = "idle";
      setBallVisible(false); // hide before re-parking so the next spin starts cleanly on the track
      anim.reset();
    }
  }, [activeEventType, landedNumber, mode, spinMs, landMs]);

  useFrame(({ camera }) => {
    const now = performance.now();
    const anim = animRef.current!;
    // honour a force-finalize request from the queue (snap the landing to its final state)
    if (forceFinalizeRef.current && phaseRef.current === "land") anim.forceFinalize();
    const s = anim.sample(now);
    if (rotorRef.current) rotorRef.current.rotation.y = deg(s.rotorDeg);
    if (ballRef.current) {
      const a = (s.ballDeg * Math.PI) / 180;
      const sinA = Math.sin(a);
      const cosA = Math.cos(a);
      ballRef.current.position.set(s.ballR * sinA, s.ballY, -s.ballR * cosA);
      radialRef.current.set(sinA, 0, -cosA);
      ballRef.current.setRotationFromAxisAngle(radialRef.current, s.ballRoll);

      // Ball contact shadow — a purely cosmetic blob on the pocket-floor plane, directly beneath the
      // ball in world space. It reads the INWARD_DROP, each DEFLECTOR/POCKET bounce and the final SETTLE
      // by tightening + darkening as the ball nears the floor, and stays as a small dark contact patch
      // riding under the ball through ROTOR_SYNC. It never touches angle/radius/height or the result —
      // it is driven entirely by the already-decided ball position (s.ballR / s.ballY).
      const shadow = ballShadowRef.current;
      if (shadow) {
        // gate: fade in only once the ball has left the outer track and is over the pocket ring
        const over = clamp01((R.trackR - s.ballR) / (R.trackR - R.pocketOuter));
        shadow.visible = ballVisible && over > 0.01;
        if (shadow.visible) {
          shadow.position.set(s.ballR * sinA, R.floorY + 0.02, -s.ballR * cosA);
          // lift above the resting height → bigger, softer shadow; flush at rest → tight, dark
          const lift = clamp01((s.ballY - R.ballRestY) / 0.55);
          const scale = 0.34 + lift * 0.5;
          shadow.scale.set(scale, scale, scale);
          const mat = shadow.material as THREE.MeshBasicMaterial;
          mat.opacity = over * (0.6 - lift * 0.4);
        }
      }
    }

    // ★ Report only AFTER the final transform has been applied AND painted: this frame the final
    // transform is written (R3F renders it after useFrame); the NEXT frame we report. So the queue
    // never reveals before a frame with the settled ball has actually been drawn, and — because
    // useFrame is rAF-driven — a hidden tab (rAF paused) cannot report at all (§17 / audit #2,#3).
    if (s.landed) {
      const eid = landEventIdRef.current;
      if (eid) {
        if (finalAppliedRef.current !== eid) {
          finalAppliedRef.current = eid; // applied this frame → defer the report to the next paint
        } else if (reportedLandRef.current !== eid) {
          reportedLandRef.current = eid;
          onLandingCompleteRef.current?.(eid);
        }
      }
    }

    // winner frame glow — gentle fade-in once the result is revealed (which the queue only does AFTER the
    // BALL_LAND ack). The mesh mounts only when revealed, so it always fades from 0.
    if (winnerGlowRef.current && resultRevealed) {
      const gmat = winnerGlowRef.current.material as THREE.MeshStandardMaterial;
      if (gmat.opacity < 0.9) gmat.opacity = Math.min(0.9, gmat.opacity + 0.045);
    }

    // camera — FIXED framing, identical for every mode. No dolly / zoom / orbit / landing descent: the
    // standard↔full difference lives entirely in the ball (timing/motion/density), never the camera.
    // Locked each frame so nothing can drift it; `closeUp`/`mode` deliberately have no effect here.
    camera.position.copy(WHEEL_CAMERA_POSITION);
    camera.lookAt(WHEEL_CAMERA_LOOK_AT);
  });

  const winner = resultRevealed ? dollyNumber ?? landedNumber : null;
  if (!res) return null; // resources build on first commit — one blank frame, then the full scene

  return (
    <group>
      {/* ── static bowl: turned wood + polished ball track + rim (hook-owned geom+mat → dispose={null}) ── */}
      <mesh geometry={res.bowlGeom} material={res.bowlMat} dispose={null} />
      {/* gold rim crown */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.7, 0]}>
        <torusGeometry args={[R.rimR, R.rimTube, 24, 120]} />
        <meshStandardMaterial {...MAT.gold} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.78, 0]}>
        <torusGeometry args={[R.rimR, R.rimTube * 0.4, 16, 120]} />
        <meshStandardMaterial {...MAT.goldHi} />
      </mesh>

      <Deflectors />

      {/* ── rotor (spins; whole turns → identity at rest) ── */}
      <group ref={rotorRef}>
        {/* recessed numbered pocket floor (hook-owned geom+mat → dispose={null}) */}
        <mesh geometry={res.floorGeom} material={res.floorMat} dispose={null} position={[0, 0.001, 0]} />
        <Frets geom={res.fretGeom} mat={res.fretMat} />
        <Numbers numbers={res.numbers} />

        {/* centre cone + ornate gold turret (the wheel's crown) */}
        <mesh position={[0, R.floorY + R.coneH / 2, 0]}>
          <coneGeometry args={[R.coneBaseR, R.coneH, 72]} />
          <meshStandardMaterial {...MAT.cone} map={res.woodTex} />
        </mesh>
        {/* gold collar at the cone base */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, R.floorY + 0.03, 0]}>
          <torusGeometry args={[R.coneBaseR - 0.02, 0.06, 16, 80]} />
          <meshStandardMaterial {...MAT.gold} />
        </mesh>
        {(() => {
          const apex = R.floorY + R.coneH; // 0.65
          return (
            <group>
              {/* tapered hub seat */}
              <mesh position={[0, apex + 0.05, 0]}>
                <cylinderGeometry args={[R.hubR, R.hubR * 1.35, 0.4, 56]} />
                <meshStandardMaterial {...MAT.gold} />
              </mesh>
              {/* mid collar */}
              <mesh position={[0, apex + 0.32, 0]}>
                <cylinderGeometry args={[R.hubR * 0.78, R.hubR, 0.22, 56]} />
                <meshStandardMaterial {...MAT.goldHi} />
              </mesh>
              {/* spindle shaft */}
              <mesh position={[0, apex + 0.62, 0]}>
                <cylinderGeometry args={[R.spindleR, R.spindleR * 1.2, 0.62, 28]} />
                <meshStandardMaterial {...MAT.gold} />
              </mesh>
              {/* finial knob */}
              <mesh position={[0, apex + 0.98, 0]}>
                <sphereGeometry args={[R.spindleR * 2.1, 28, 28]} />
                <meshStandardMaterial {...MAT.goldHi} />
              </mesh>
              {/* cross handles */}
              {[0, 90].map((a) => (
                <mesh key={a} position={[0, apex + 0.2, 0]} rotation={[0, deg(a), 0]}>
                  <boxGeometry args={[R.hubR * 2.7, 0.07, 0.11]} />
                  <meshStandardMaterial {...MAT.goldLo} />
                </mesh>
              ))}
              {/* handle end caps (four cardinal ends) */}
              {[0, 90, 180, 270].map((a) => (
                <mesh key={a} position={posAt(a, R.hubR * 1.35, apex + 0.2)}>
                  <sphereGeometry args={[0.08, 16, 16]} />
                  <meshStandardMaterial {...MAT.goldHi} />
                </mesh>
              ))}
            </group>
          );
        })()}

        {/* winner emphasis (reveal-gated; rides the rotor so it always tracks the pocket). The old disc
            marker is gone — this is a glowing FRAME around the winning bay that never overlaps the digit,
            plus a soft top light. Opacity fades in from 0 (ramped in useFrame). */}
        {winner != null && (
          <group rotation={[0, rotationYForWheelAngle(angleOf(winner)), 0]}>
            <mesh ref={winnerGlowRef} geometry={res.pocketFrameGeom} position={[0, R.floorY + 0.01, 0]} dispose={null} renderOrder={3}>
              <meshStandardMaterial color="#fff4d8" emissive="#ffe39a" emissiveIntensity={3.4} metalness={0.2} roughness={0.3} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {/* soft local pool over the winning bay — brightens curb + floor + digit, no disc over the number */}
            <pointLight position={posAt(0, R.pocketMidR, R.floorY + 1.2)} intensity={1.7} distance={2.6} decay={2} color="#ffe7b0" />
          </group>
        )}
      </group>

      {/* ── ball ── */}
      <mesh ref={ballRef} visible={ballVisible} position={[0, R.ballSpinY, -R.ballOrbitR]}>
        <sphereGeometry args={[R.ballR, 32, 32]} />
        <meshPhysicalMaterial {...BALL_MAT} />
      </mesh>

      {/* ball contact shadow — tracks the ball on the pocket-floor plane; size/opacity driven per-frame
          from the ball height (see useFrame). Reuses the hook-owned soft radial texture (disposed once
          by the hook → dispose={null} so R3F never double-disposes it). Starts hidden. */}
      <mesh ref={ballShadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, R.floorY + 0.02, 0]} visible={false} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={res.shadowTex} transparent opacity={0} depthWrite={false} dispose={null} />
      </mesh>

      {/* soft baked contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, R.floorY - 0.34, 0]}>
        <planeGeometry args={[R.bowlOuterR * 2.6, R.bowlOuterR * 2.6]} />
        <meshBasicMaterial map={res.shadowTex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── instanced rotor children ──────────────────────────────────────────────────
// Short radial brass FINS at the pocket boundaries, sitting in the inner ~third of the bay only (the
// number-ring / ball area stays open). Geometry + material are hook-owned (built in useWheelResources)
// → dispose={null} so R3F never double-disposes them. Each fin's base is at y=0, so it is positioned at
// floorY (not floorY + h/2), at fretCenterR, oriented so its local +Z points radially outward.
function Frets({ geom, mat }: { geom: THREE.BufferGeometry; mat: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3(1, 1, 1);
    FRET_ANGLES.forEach((a, i) => {
      const [x, y, z] = posAt(a, R.fretCenterR, R.floorY);
      pos.set(x, y, z);
      q.setFromAxisAngle(Y_AXIS, deg(180 - a));
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [geom]);
  return <instancedMesh ref={ref} args={[geom, mat, FRET_ANGLES.length]} dispose={null} />;
}

function Deflectors() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    DEFLECTOR_ANGLES.forEach((a, i) => {
      const [x, y, z] = posAt(a, R.deflectorR, R.deflectorY);
      pos.set(x, y, z);
      q.setFromAxisAngle(Y_AXIS, deg(180 - a));
      // alternate radial / tangential diamonds, like a real apron
      if (i % 2 === 0) scl.set(0.14, 0.16, 0.3);
      else scl.set(0.3, 0.16, 0.14);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, DEFLECTOR_ANGLES.length]}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial {...MAT.steel} flatShading />
    </instancedMesh>
  );
}

function Numbers({ numbers }: { numbers: ReadonlyArray<{ n: number; angle: number; tex: THREE.Texture }> }) {
  return (
    <group>
      {numbers.map((p) => (
        <mesh key={p.n} position={posAt(p.angle, R.numberR, R.floorY + 0.08)} rotation={[-Math.PI / 2, 0, deg(-p.angle)]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial map={p.tex} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
