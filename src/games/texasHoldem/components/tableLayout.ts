// games/texasHoldem/components/tableLayout.ts
// Geometry for the stadium poker table. Players sit on the OUTSIDE of the felt; the inside of
// the felt is reserved for community cards / pot / bet chips / bet line (spec §24.1, redesign).
// Pure geometry — no game state.
//
//            CPU1            CPU2          (seats 1, 2 — above the felt)
//   CPU4  ┌──────────────────────┐  CPU3  (seats 4, 3 — beside the felt)
//         │  pot                 │
//         │      [ community ]   │
//         └──────────────────────┘
//                  YOU                     (seat 0 — below the felt)
//               [Hole][Hole]

export interface SeatSlot {
  /** Seat plaque centre, as % of the STAGE box — sits OUTSIDE the felt. */
  seat: { left: number; top: number };
  /** This seat's bet chips, as % of the FELT box — sits just INSIDE the rail. */
  bet: { left: number; top: number };
  /** px vector from the bet spot toward the pot (chip-to-pot flight). */
  fly: { x: number; y: number };
  /** Render hole cards below the plaque (true for top seats) instead of above. */
  cardsBelow?: boolean;
  /** The human seat (bottom, larger cards). */
  hero?: boolean;
}

/** The felt's inset within the stage (must match PokerTable). Used to place the bet layer. */
export const FELT_INSET = { left: 9, right: 9, top: 16, bottom: 26 } as const;

export const SEAT_SLOTS: Record<number, SeatSlot> = {
  0: { seat: { left: 50, top: 82 }, bet: { left: 50, top: 80 }, fly: { x: 0, y: -120 }, hero: true },
  1: { seat: { left: 31, top: 7 }, bet: { left: 33, top: 22 }, fly: { x: 55, y: 100 }, cardsBelow: true },
  2: { seat: { left: 69, top: 7 }, bet: { left: 67, top: 22 }, fly: { x: -55, y: 100 }, cardsBelow: true },
  3: { seat: { left: 94, top: 45 }, bet: { left: 79, top: 50 }, fly: { x: -120, y: 6 } },
  4: { seat: { left: 6, top: 45 }, bet: { left: 21, top: 50 }, fly: { x: 120, y: 6 } },
};

export function seatSlot(seatIndex: number): SeatSlot {
  return SEAT_SLOTS[seatIndex] ?? SEAT_SLOTS[0]!;
}
