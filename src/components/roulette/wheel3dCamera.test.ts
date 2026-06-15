import { describe, expect, it } from "vitest";
import {
  WHEEL_CAMERA_POSITION,
  WHEEL_CAMERA_LOOK_AT,
  WHEEL_CAMERA_FOV,
  wheelCameraFraming,
} from "./wheel3dCamera";
import type { RouletteAnimationMode } from "./animationMode";

// The camera-fix contract (§ camera): standard and full (and reduced) share ONE framing. There is no
// per-mode dolly / zoom / orbit / landing descent, and the cinematic `closeUp` flag has no 3D-camera
// effect. These tests fail the moment a mode- or closeUp-driven camera move sneaks back in.
const MODES: RouletteAnimationMode[] = ["standard", "full", "reduced"];

describe("wheelCameraFraming — one fixed framing for every mode (camera fix)", () => {
  it("standard and full resolve to IDENTICAL position, lookAt and fov", () => {
    const std = wheelCameraFraming("standard");
    const full = wheelCameraFraming("full");
    expect(full.position.toArray()).toEqual(std.position.toArray());
    expect(full.lookAt.toArray()).toEqual(std.lookAt.toArray());
    expect(full.fov).toBe(std.fov);
  });

  it("is identical across every mode × closeUp combination (mode/closeUp have no effect)", () => {
    const base = wheelCameraFraming("standard", false);
    for (const mode of MODES) {
      for (const closeUp of [false, true]) {
        const f = wheelCameraFraming(mode, closeUp);
        expect(f.position.toArray()).toEqual(base.position.toArray());
        expect(f.lookAt.toArray()).toEqual(base.lookAt.toArray());
        expect(f.fov).toBe(base.fov);
      }
    }
  });

  it("toggling closeUp within full mode does NOT change the framing (no cinematic dolly-in)", () => {
    const wide = wheelCameraFraming("full", false);
    const close = wheelCameraFraming("full", true);
    expect(close.position.toArray()).toEqual(wide.position.toArray());
    expect(close.lookAt.toArray()).toEqual(wide.lookAt.toArray());
    expect(close.fov).toBe(wide.fov);
  });

  it("resolves to the shared constants and returns fresh, mutation-safe clones", () => {
    const f = wheelCameraFraming("full", true);
    expect(f.position.toArray()).toEqual(WHEEL_CAMERA_POSITION.toArray());
    expect(f.lookAt.toArray()).toEqual(WHEEL_CAMERA_LOOK_AT.toArray());
    expect(f.fov).toBe(WHEEL_CAMERA_FOV);
    // mutating the returned vectors must not corrupt the shared constants or other callers
    f.position.set(99, 99, 99);
    f.lookAt.set(99, 99, 99);
    expect(WHEEL_CAMERA_POSITION.toArray()).toEqual([0, 7.6, 10.0]);
    expect(wheelCameraFraming("full", true).position.toArray()).toEqual([0, 7.6, 10.0]);
  });
});
