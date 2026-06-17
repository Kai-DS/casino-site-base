// components/roulette/wheel3dCamera.ts
// SINGLE SOURCE OF TRUTH for the 3D wheel's camera framing. The composition (position / look-at / FOV)
// is a fixed 3/4 view that keeps the whole bowl — and therefore the ball — in shot at all times.
//
// CONTRACT: framing is IDENTICAL for every animation mode and ignores the cinematic `closeUp` flag. There
// is deliberately NO mode-driven dolly / zoom / orbit / landing descent: switching standard↔full changes
// only the BALL's timing / motion / density, never the camera. `wheelCameraFraming()` accepts mode and
// closeUp purely so call-sites can stay symmetric, but returns the same framing regardless — this is
// asserted by wheel3dCamera.test.ts so the long-mode camera move can never silently come back.
import * as THREE from "three";
import type { RouletteAnimationMode } from "./animationMode";

/** The one camera position — a wide 3/4 view that always frames the entire bowl. */
export const WHEEL_CAMERA_POSITION = new THREE.Vector3(0, 7.6, 10.0);
/** The one look-at target. */
export const WHEEL_CAMERA_LOOK_AT = new THREE.Vector3(0, 0.0, -0.15);
/** The one field of view (deg). */
export const WHEEL_CAMERA_FOV = 36;

export interface WheelCameraFraming {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  fov: number;
}

/**
 * Resolve the camera framing. Pure and mode-independent: the args are accepted only so call-sites read
 * symmetrically — `_mode` and `_closeUp` have NO effect. Returns fresh clones so callers may mutate them
 * (e.g. copy into the live camera) without touching the shared constants.
 */
export function wheelCameraFraming(_mode?: RouletteAnimationMode, _closeUp?: boolean): WheelCameraFraming {
  return {
    position: WHEEL_CAMERA_POSITION.clone(),
    lookAt: WHEEL_CAMERA_LOOK_AT.clone(),
    fov: WHEEL_CAMERA_FOV,
  };
}
