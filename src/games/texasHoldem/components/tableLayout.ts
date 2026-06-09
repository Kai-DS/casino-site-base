// games/texasHoldem/components/tableLayout.ts
// Where each seat sits around the elliptical felt (spec §24.1 layout) and which way its
// chips travel to the central pot. Pure geometry — no game state.
//
//        CPU1            CPU2          (seats 1, 2)
//   CPU4   [ COMMUNITY ]      CPU3     (seats 4, 3)
//             [ POT ]
//               YOU                    (seat 0)
//            [Hole][Hole]

export interface SeatSlot {
  /** Position of the seat centre, as % of the table box. */
  left: number;
  top: number;
  /** Approx. px vector from the seat toward the pot (used for chip flight). */
  fly: { x: number; y: number };
  /** Hero (the human) gets larger cards anchored at the bottom. */
  hero?: boolean;
}

/** Index by seatIndex (0 = human, 1..4 = CPUs). */
export const SEAT_SLOTS: Record<number, SeatSlot> = {
  0: { left: 50, top: 84, fly: { x: 0, y: -150 }, hero: true },
  1: { left: 30, top: 13, fly: { x: 70, y: 120 } },
  2: { left: 70, top: 13, fly: { x: -70, y: 120 } },
  3: { left: 88, top: 46, fly: { x: -150, y: 30 } },
  4: { left: 12, top: 46, fly: { x: 150, y: 30 } },
};

export function seatSlot(seatIndex: number): SeatSlot {
  return SEAT_SLOTS[seatIndex] ?? SEAT_SLOTS[0]!;
}
