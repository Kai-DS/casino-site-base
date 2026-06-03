// repositories/userRepository.ts — user-slice operations. chips are part of user
// (no chipRepository — see spec §11). Persistence flows through storage.ts only.
import type { UserProfile } from "@/types/user";
import { uuid } from "@/utils/id";

export const STARTING_CHIPS = 10000;

/** Pure factory for a fresh guest profile (spec §7.2). */
export function createGuestProfile(name: string): UserProfile {
  const now = new Date().toISOString();
  const trimmed = name.trim();
  return {
    id: uuid(),
    name: trimmed.length > 0 ? trimmed : "Guest",
    chips: STARTING_CHIPS,
    level: 1,
    totalPlays: 0,
    totalProfit: 0,
    wins: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Profile level rule (spec §7.7): level = floor(totalPlays / 50) + 1. */
export function computeLevel(totalPlays: number): number {
  return Math.floor(totalPlays / 50) + 1;
}
