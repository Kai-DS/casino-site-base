// types/casino.ts — see spec §10
import type { GameId } from "./game";

export type RateId = "low" | "middle" | "high" | "vip" | "royal" | "legend";

export type Rate = {
  id: RateId;
  label: string;
  // Buy-in (持ち込み): eligibility gate is `chips >= buyInMin`. A session brings a stack
  // in [buyInMin, min(buyInMax, chips)]; when it runs out you re-buy in the same range.
  buyInMin: number;
  buyInMax: number;
  // Bet scale: betMin = 1 BET (one coin), betMax = MAX BET (= 5 × betMin). Per-game adapters
  // interpret these (slot = chips/medal on betMin; poker = chosen coins 1..5).
  betMin: number;
  betMax: number;
  blurb: string; // 目安 — short flavour text
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
