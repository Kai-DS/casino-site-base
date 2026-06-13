// components/roulette/RouletteWheel.tsx
// The wheel entry point (Roulette 3D Wheel Upgrade §4.1). Renders the real 3D wheel when WebGL is
// available and motion isn't reduced; otherwise (no WebGL / 3D init failure / reduced motion) it shows
// the pure CSS/SVG fallback so the game never breaks (§14). The 3D module is lazy-loaded so three.js
// stays off the main bundle and only loads on the roulette table. Props/contract are unchanged.
import { Component, Suspense, lazy, useMemo, type ReactNode } from "react";
import type { RouletteAnimationMode } from "./animationMode";
import { RouletteWheelFallback } from "./RouletteWheelFallback";

const RouletteWheel3D = lazy(() => import("./RouletteWheel3D").then((m) => ({ default: m.RouletteWheel3D })));

export interface RouletteWheelProps {
  activeEventType: string | null;
  landedNumber: number | null;
  resultRevealed: boolean;
  dollyNumber: number | null;
  mode: RouletteAnimationMode;
  spinMs: number;
  landMs: number;
  /** Long-mode cinematic close-up (camera dolly in the 3D wheel). */
  closeUp?: boolean;
  reducedMotion?: boolean;
}

function webglSupported(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}
class WheelErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function RouletteWheel(props: RouletteWheelProps) {
  const supported = useMemo(webglSupported, []);
  const fallback = (
    <div className="wheel-tilt h-full w-full">
      <RouletteWheelFallback
        activeEventType={props.activeEventType}
        landedNumber={props.landedNumber}
        resultRevealed={props.resultRevealed}
        dollyNumber={props.dollyNumber}
        mode={props.mode}
        spinMs={props.spinMs}
        landMs={props.landMs}
      />
    </div>
  );

  if (!supported || props.reducedMotion) return fallback;

  return (
    <WheelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <RouletteWheel3D
          activeEventType={props.activeEventType}
          landedNumber={props.landedNumber}
          resultRevealed={props.resultRevealed}
          dollyNumber={props.dollyNumber}
          mode={props.mode}
          spinMs={props.spinMs}
          landMs={props.landMs}
          closeUp={props.closeUp ?? false}
        />
      </Suspense>
    </WheelErrorBoundary>
  );
}
