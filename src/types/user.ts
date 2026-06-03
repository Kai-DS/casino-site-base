// types/user.ts — see spec §10
export type UserProfile = {
  id: string;
  name: string;
  chips: number; // ← the single source of truth for chips
  level: number;
  totalPlays: number;
  totalProfit: number;
  wins: number; // explicit origin of the "win count" shown on the profile
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
};

export type DailyBonus = {
  lastClaimedAt: string | null; // compared as YYYY-MM-DD (local calendar day)
  amount: number;
  lastRescuedAt: string | null; // ISO8601, for the bankruptcy-rescue cooldown
};
