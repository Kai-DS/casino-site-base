import { describe, expect, it } from "vitest";
import { rouletteSandboxRouteEnabled } from "./router";

describe("router production hardening", () => {
  it("only enables the roulette sandbox route in development", () => {
    expect(rouletteSandboxRouteEnabled({ DEV: true })).toBe(true);
    expect(rouletteSandboxRouteEnabled({ DEV: false })).toBe(false);
  });
});
