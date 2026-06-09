// games/texasHoldem/components/holdemLabels.ts
// Display-only labels for the Hold'em UI. NO game logic, NO scoring — these just turn the
// values the logic hands us (HandCategory, HoldemActionKind) into on-screen text.
//
// Distinct from Video Poker's PAYOUT_LABELS, which are VP-specific (e.g. one_pair →
// "JACKS OR BETTER"). Hold'em shows the plain poker hand names.
import type { HandCategory } from "@/games/shared/poker/handEvaluator";
import type { HoldemActionError, HoldemActionKind } from "../types";

export const HAND_CATEGORY_LABEL: Record<HandCategory, string> = {
  royal_flush: "ROYAL FLUSH",
  straight_flush: "STRAIGHT FLUSH",
  four_of_a_kind: "FOUR OF A KIND",
  full_house: "FULL HOUSE",
  flush: "FLUSH",
  straight: "STRAIGHT",
  three_of_a_kind: "THREE OF A KIND",
  two_pair: "TWO PAIR",
  one_pair: "ONE PAIR",
  high_card: "HIGH CARD",
};

/** Result category includes "fold" (won because everyone else folded). */
export function resultCategoryLabel(category: HandCategory | "fold"): string {
  return category === "fold" ? "WIN BY FOLD" : HAND_CATEGORY_LABEL[category];
}

export const ACTION_LABEL: Record<HoldemActionKind, string> = {
  fold: "FOLD",
  check: "CHECK",
  call: "CALL",
  bet: "BET",
  raise: "RAISE",
  allIn: "ALL-IN",
};

/** Short label for a seat's action, e.g. "RAISE 300" / "CALL" / "ALL-IN". */
export function actionLabel(action: HoldemActionKind, amount?: number): string {
  const base = ACTION_LABEL[action];
  return amount && amount > 0 ? `${base} ${amount.toLocaleString("en-US")}` : base;
}

// ── availableActions disabled reasons → tooltip text (§9.3 / §24.10) ─────────
// These explain *why* a button is dimmed. The enable/disable decision itself is the logic's
// (availableActions[kind].enabled) — the UI never recomputes legality.
const REASON_TEXT: Record<HoldemActionError, string> = {
  ANIMATING: "演出中です",
  NOT_SEATED: "着席していません",
  INVALID_PHASE: "今はこの操作はできません",
  NOT_YOUR_TURN: "あなたのターンではありません",
  INVALID_BET: "ベット額が不正です",
  INSUFFICIENT_CHIPS: "チップが不足しています",
  INSUFFICIENT_TABLE_STACK: "テーブルスタックが不足しています",
  REBUY_REQUIRED: "リバイが必要です",
  SIDE_POT_NOT_SUPPORTED: "この状況は未対応です",
  DECK_EXHAUSTED: "デッキが不足しています",
  DUPLICATE_CARD: "カードが重複しています",
  INVALID_CARD: "不正なカードです",
  ECONOMY_FAILED: "残高処理に失敗しました",
};

export function reasonText(reason?: HoldemActionError): string | undefined {
  return reason ? REASON_TEXT[reason] : undefined;
}

// ── §24.8 win-FX tiers by hand category ──────────────────────────────────────
export type WinTier = "subtle" | "standard" | "strong" | "big" | "premier";

export function winTier(category: HandCategory | "fold"): WinTier {
  switch (category) {
    case "fold":
    case "high_card":
    case "one_pair":
      return "subtle";
    case "two_pair":
    case "three_of_a_kind":
      return "standard";
    case "straight":
    case "flush":
      return "strong";
    case "full_house":
    case "four_of_a_kind":
      return "big";
    case "straight_flush":
    case "royal_flush":
      return "premier";
  }
}
