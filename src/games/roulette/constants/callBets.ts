import type { PositionId } from "../types";
import { WHEEL_ORDER } from "./wheel";

export type CallBetId = "voisins" | "tiers" | "orphelins" | "jeuZero";

export interface CallBetDef {
  id: CallBetId;
  label: string;
  chipCount: number;
  components: ReadonlyArray<{ positionId: PositionId; chips: number }>;
}

export const CALL_BET_DEFS: Readonly<Record<CallBetId, CallBetDef>> = Object.freeze({
  voisins: Object.freeze({
    id: "voisins",
    label: "VOISINS DU ZÉRO",
    chipCount: 9,
    components: Object.freeze([
      { positionId: "trio-0-2-3", chips: 2 },
      { positionId: "split-4-7", chips: 1 },
      { positionId: "split-12-15", chips: 1 },
      { positionId: "split-18-21", chips: 1 },
      { positionId: "split-19-22", chips: 1 },
      { positionId: "corner-25-26-28-29", chips: 2 },
      { positionId: "split-32-35", chips: 1 },
    ]),
  }),
  tiers: Object.freeze({
    id: "tiers",
    label: "TIERS DU CYLINDRE",
    chipCount: 6,
    components: Object.freeze([
      { positionId: "split-5-8", chips: 1 },
      { positionId: "split-10-11", chips: 1 },
      { positionId: "split-13-16", chips: 1 },
      { positionId: "split-23-24", chips: 1 },
      { positionId: "split-27-30", chips: 1 },
      { positionId: "split-33-36", chips: 1 },
    ]),
  }),
  orphelins: Object.freeze({
    id: "orphelins",
    label: "ORPHELINS",
    chipCount: 5,
    components: Object.freeze([
      { positionId: "straight-1", chips: 1 },
      { positionId: "split-6-9", chips: 1 },
      { positionId: "split-14-17", chips: 1 },
      { positionId: "split-17-20", chips: 1 },
      { positionId: "split-31-34", chips: 1 },
    ]),
  }),
  jeuZero: Object.freeze({
    id: "jeuZero",
    label: "JEU ZÉRO",
    chipCount: 4,
    components: Object.freeze([
      { positionId: "split-0-3", chips: 1 },
      { positionId: "split-12-15", chips: 1 },
      { positionId: "split-32-35", chips: 1 },
      { positionId: "straight-26", chips: 1 },
    ]),
  }),
});

export function makeNeighborsBet(
  center: number,
  n: number,
): ReadonlyArray<{ positionId: PositionId; chips: number }> {
  const idx = WHEEL_ORDER.indexOf(center as (typeof WHEEL_ORDER)[number]);
  if (idx < 0) throw new RangeError(`Invalid roulette neighbor center: ${center}`);
  if (!Number.isInteger(n) || n < 1 || n > 4) {
    throw new RangeError(`Roulette neighbor range must be an integer from 1 to 4: ${n}`);
  }

  const components: Array<{ positionId: PositionId; chips: number }> = [];
  for (let k = -n; k <= n; k += 1) {
    const number = WHEEL_ORDER[(idx + k + WHEEL_ORDER.length) % WHEEL_ORDER.length]!;
    components.push({ positionId: `straight-${number}`, chips: 1 });
  }
  return Object.freeze(components);
}
