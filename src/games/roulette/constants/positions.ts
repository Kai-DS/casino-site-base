import type { BetCategory, BetPosition, BetType, PositionId } from "../types";
import { RED_NUMBERS } from "./wheel";

type PositionCountByType = Readonly<Record<BetType, number>>;

export const EXPECTED_POSITION_COUNTS: PositionCountByType = {
  straight: 37,
  split: 60,
  street: 12,
  corner: 22,
  sixLine: 11,
  trio: 2,
  firstFour: 1,
  red: 1,
  black: 1,
  odd: 1,
  even: 1,
  low: 1,
  high: 1,
  dozen: 3,
  column: 3,
};

const EXPECTED_TOTAL = 157;

function sorted(numbers: readonly number[]): readonly number[] {
  return Object.freeze([...numbers].sort((a, b) => a - b));
}

function idFor(type: BetType, numbers: readonly number[]): PositionId {
  switch (type) {
    case "straight":
      return `straight-${numbers[0]}`;
    case "split":
      return `split-${numbers.join("-")}`;
    case "street":
      return `street-${numbers.join("-")}`;
    case "corner":
      return `corner-${numbers.join("-")}`;
    case "sixLine":
      return `six-${numbers.join("-")}`;
    case "trio":
      return `trio-${numbers.join("-")}`;
    case "firstFour":
      return `first4-${numbers.join("-")}`;
    default:
      return type;
  }
}

function position(
  type: BetType,
  coveredNumbers: readonly number[],
  payout: number,
  category: BetCategory,
  label?: string,
  id?: PositionId,
): BetPosition {
  const numbers = sorted(coveredNumbers);
  return Object.freeze({
    id: id ?? idFor(type, numbers),
    type,
    label: label ?? numbers.join("/"),
    coveredNumbers: numbers,
    payout,
    category,
  });
}

function rowNumbers(row: number): readonly [number, number, number] {
  return [3 * row - 2, 3 * row - 1, 3 * row];
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n += 1) out.push(n);
  return out;
}

function buildPositions(): readonly BetPosition[] {
  const positions: BetPosition[] = [];

  for (let n = 0; n <= 36; n += 1) {
    positions.push(position("straight", [n], 35, "inside", String(n)));
  }

  for (let row = 1; row <= 12; row += 1) {
    const [a, b, c] = rowNumbers(row);
    positions.push(position("split", [a, b], 17, "inside"));
    positions.push(position("split", [b, c], 17, "inside"));
  }
  for (let row = 1; row <= 11; row += 1) {
    const [a, b, c] = rowNumbers(row);
    positions.push(position("split", [a, a + 3], 17, "inside"));
    positions.push(position("split", [b, b + 3], 17, "inside"));
    positions.push(position("split", [c, c + 3], 17, "inside"));
  }
  positions.push(position("split", [0, 1], 17, "inside"));
  positions.push(position("split", [0, 2], 17, "inside"));
  positions.push(position("split", [0, 3], 17, "inside"));

  for (let row = 1; row <= 12; row += 1) {
    positions.push(position("street", rowNumbers(row), 11, "inside"));
  }

  for (let row = 1; row <= 11; row += 1) {
    const [a, b, c] = rowNumbers(row);
    positions.push(position("corner", [a, b, a + 3, b + 3], 8, "inside"));
    positions.push(position("corner", [b, c, b + 3, c + 3], 8, "inside"));
  }

  for (let row = 1; row <= 11; row += 1) {
    positions.push(position("sixLine", [...rowNumbers(row), ...rowNumbers(row + 1)], 5, "inside"));
  }

  positions.push(position("trio", [0, 1, 2], 11, "inside"));
  positions.push(position("trio", [0, 2, 3], 11, "inside"));
  positions.push(position("firstFour", [0, 1, 2, 3], 8, "inside"));

  const red = range(1, 36).filter((n) => RED_NUMBERS.has(n));
  const black = range(1, 36).filter((n) => !RED_NUMBERS.has(n));
  positions.push(position("red", red, 1, "outside", "RED", "red"));
  positions.push(position("black", black, 1, "outside", "BLACK", "black"));
  positions.push(position("odd", range(1, 36).filter((n) => n % 2 === 1), 1, "outside", "ODD", "odd"));
  positions.push(position("even", range(1, 36).filter((n) => n % 2 === 0), 1, "outside", "EVEN", "even"));
  positions.push(position("low", range(1, 18), 1, "outside", "1-18", "low"));
  positions.push(position("high", range(19, 36), 1, "outside", "19-36", "high"));

  for (let dozen = 1; dozen <= 3; dozen += 1) {
    const from = (dozen - 1) * 12 + 1;
    positions.push(position("dozen", range(from, from + 11), 2, "outside", `${dozen}${dozen === 1 ? "st" : dozen === 2 ? "nd" : "rd"} 12`, `dozen-${dozen}`));
  }

  for (let column = 1; column <= 3; column += 1) {
    const nums: number[] = [];
    for (let n = column; n <= 36; n += 3) nums.push(n);
    positions.push(position("column", nums, 2, "outside", `Column ${column}`, `column-${column}`));
  }

  return Object.freeze(positions);
}

export const POSITION_LIST: readonly BetPosition[] = buildPositions();

export const POSITION_TABLE: Readonly<Record<PositionId, BetPosition>> = Object.freeze(
  Object.fromEntries(POSITION_LIST.map((p) => [p.id, p])),
);

export function validatePositionTable(positions: readonly BetPosition[] = POSITION_LIST): void {
  if (positions.length !== EXPECTED_TOTAL) {
    throw new Error(`Roulette position count mismatch: expected ${EXPECTED_TOTAL}, got ${positions.length}`);
  }

  const ids = new Set<PositionId>();
  const counts: Record<BetType, number> = {
    straight: 0,
    split: 0,
    street: 0,
    corner: 0,
    sixLine: 0,
    trio: 0,
    firstFour: 0,
    red: 0,
    black: 0,
    odd: 0,
    even: 0,
    low: 0,
    high: 0,
    dozen: 0,
    column: 0,
  };

  for (const pos of positions) {
    if (ids.has(pos.id)) throw new Error(`Duplicate roulette position id: ${pos.id}`);
    ids.add(pos.id);
    counts[pos.type] += 1;

    const seen = new Set<number>();
    let previous = -1;
    for (const n of pos.coveredNumbers) {
      if (n < 0 || n > 36 || !Number.isInteger(n)) {
        throw new Error(`Invalid covered number in ${pos.id}: ${n}`);
      }
      if (seen.has(n)) throw new Error(`Duplicate covered number in ${pos.id}: ${n}`);
      if (n <= previous) throw new Error(`Covered numbers are not ascending in ${pos.id}`);
      seen.add(n);
      previous = n;
    }

    if (pos.coveredNumbers.length * (pos.payout + 1) !== 36) {
      throw new Error(`Invalid roulette payout invariant for ${pos.id}`);
    }
  }

  for (const [type, expected] of Object.entries(EXPECTED_POSITION_COUNTS) as Array<[BetType, number]>) {
    if (counts[type] !== expected) {
      throw new Error(`Roulette ${type} count mismatch: expected ${expected}, got ${counts[type]}`);
    }
  }
}

validatePositionTable();
