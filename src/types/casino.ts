// types/casino.ts — see spec §10
import type { GameId } from "./game";

export type RateId = "low" | "middle" | "high" | "vip";

export type Rate = {
  id: RateId;
  label: string;
  minBalance: number; // entry gate (NOT subtracted)
  betUnit: number; // betting scale (interpreted per-game by each adapter)
};

export type TransactionType = "bet" | "win" | "bonus" | "refund";
export type TransactionSource = "daily" | "rescue";

export type ChipTransaction = {
  // ledger — the signed log of every change to UserProfile.chips
  id: string;
  userId: string;
  gameId: GameId | null; // null for bonus/refund/rescue
  type: TransactionType;
  source?: TransactionSource; // breakdown for "bonus" (optional)
  // Convention (this codebase): `amount` is SIGNED.
  //   bet  → negative, win/bonus/refund → positive.
  amount: number;
  balanceAfter: number; // MUST equal user.chips after applying this tx
  createdAt: string; // ISO8601
};
