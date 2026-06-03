// games/neonjack/types.ts — NEON JACK's own types are the source of truth.
// The casino integration layer only ever sees { bet, payout, profit }. See spec §5.5.

export type SlotSymbol = "seven" | "bar" | "grape" | "cherry" | "replay" | "blank";

/** The role of one spin (Juggler-style: two bonuses + small wins + replay). */
export type SpinRole = "big" | "reg" | "grape" | "cherry" | "replay" | "blank";

export type ReelLine = [SlotSymbol, SlotSymbol, SlotSymbol];

export type NeonJackSpinOutput = {
  role: SpinRole;
  reels: ReelLine; // the symbols shown on the centre payline
  betMedals: number; // always 3 (real-machine fixed bet)
  payoutMedals: number; // medals paid out this spin
  isBonus: boolean; // BIG or REG
  lampOn: boolean; // GOGO! lamp — lights on a bonus
};
