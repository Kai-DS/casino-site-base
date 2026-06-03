// repositories/storage.ts — the ONLY module allowed to touch localStorage. See spec §5.3.
// Thin localStorage wrapper + schemaVersion + migration. Methods are async (Promise) so a
// future Supabase swap (sync → async) won't change callers.
import type { UserProfile, DailyBonus } from "@/types/user";
import type { ChipTransaction } from "@/types/casino";
import type { GameResult } from "@/types/game";

const ROOT_KEY = "casino-hub";
export const CURRENT_SCHEMA_VERSION = 1;

export type PersistedRoot = {
  schemaVersion: number;
  user: UserProfile | null;
  transactions: ChipTransaction[];
  results: GameResult[];
  dailyBonus: DailyBonus;
  // NOTE: chips live on user.chips (single source of truth). There is no chipRepository.
};

export const DAILY_BONUS_AMOUNT = 1000;

export function createDefaultRoot(): PersistedRoot {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    user: null,
    transactions: [],
    results: [],
    dailyBonus: {
      lastClaimedAt: null,
      amount: DAILY_BONUS_AMOUNT,
      lastRescuedAt: null,
    },
  };
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export async function loadRoot(): Promise<PersistedRoot> {
  if (!hasLocalStorage()) return createDefaultRoot();
  try {
    const raw = localStorage.getItem(ROOT_KEY);
    if (!raw) return createDefaultRoot();
    const parsed = JSON.parse(raw) as PersistedRoot;
    return migrate(parsed); // bring any older version up to the latest
  } catch {
    // Corrupted / unreadable → regenerate defaults (spec §10.6 / §12.6).
    return createDefaultRoot();
  }
}

export async function saveRoot(root: PersistedRoot): Promise<void> {
  if (!hasLocalStorage()) return;
  const payload: PersistedRoot = { ...root, schemaVersion: CURRENT_SCHEMA_VERSION };
  localStorage.setItem(ROOT_KEY, JSON.stringify(payload));
}

export async function clearAll(): Promise<void> {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(ROOT_KEY);
}

/** Forward-migrate persisted data so spec revisions never break old saves. */
function migrate(root: PersistedRoot): PersistedRoot {
  let r: PersistedRoot = { ...createDefaultRoot(), ...root };

  // Future migrations go here, e.g.:
  // if ((r.schemaVersion ?? 0) < 2) { r = { ...r, /* v1 → v2 transform */ }; }

  // Defensive backfill for partially-shaped saves.
  if (!r.dailyBonus) r = { ...r, dailyBonus: createDefaultRoot().dailyBonus };
  if (!Array.isArray(r.transactions)) r = { ...r, transactions: [] };
  if (!Array.isArray(r.results)) r = { ...r, results: [] };

  return { ...r, schemaVersion: CURRENT_SCHEMA_VERSION };
}
