import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { POCKET_DEFS, R, angleOf, posAt, rotationYForWheelAngle } from "./wheel3dGeometry";

const Y_AXIS = new THREE.Vector3(0, 1, 0);

describe("wheel3dGeometry — wheel angle to Three.js rotation", () => {
  it("places a local angle-0 winner frame on the same pocket center as posAt(angleOf(n))", () => {
    for (const p of POCKET_DEFS) {
      const angle = angleOf(p.n);
      const actual = new THREE.Vector3(...posAt(0, R.pocketMidR, 0));
      actual.applyAxisAngle(Y_AXIS, rotationYForWheelAngle(angle));

      const expected = posAt(angle, R.pocketMidR, 0);
      expect(actual.x).toBeCloseTo(expected[0], 9);
      expect(actual.y).toBeCloseTo(expected[1], 9);
      expect(actual.z).toBeCloseTo(expected[2], 9);
    }
  });
});
