// components/roulette/rouletteLabels.ts
// UI-only display maps (base spec appendix A): RouletteActionError → Japanese text, and pocket
// colour → CSS. The logic never owns presentation strings.
import type { PocketColor } from "@/games/roulette/constants/wheel";
import type { RouletteActionError, SpinResult } from "@/games/roulette/types";

export function reasonText(reason?: RouletteActionError): string | undefined {
  if (!reason) return undefined;
  switch (reason) {
    case "ANIMATING":
      return "スピン中はベットできません";
    case "INVALID_PHASE":
      return "いまは操作できません";
    case "INSUFFICIENT_FUNDS":
      return "チップが足りません";
    case "POSITION_LIMIT":
      return "この場所のベット上限に達しています";
    case "TABLE_LIMIT":
      return "テーブルの合計上限に達しています";
    case "BELOW_MIN_TOTAL":
      return "最低ベット額に達していません";
    case "NO_BETS":
      return "ベットがありません";
    case "NO_LAST_BETS":
      return "前回のベットがありません";
    case "INVALID_POSITION":
    case "ECONOMY_REJECTED":
      return "エラーが発生しました";
    default:
      return undefined;
  }
}

/** Background/fill for a pocket colour (red/black/green). */
export const POCKET_FILL: Record<PocketColor, string> = {
  red: "#c2293b",
  black: "#1b2030",
  green: "#1f8a4c",
};

export const POCKET_BG_CLASS: Record<PocketColor, string> = {
  red: "bg-[#c2293b]",
  black: "bg-[#1b2030]",
  green: "bg-[#1f8a4c]",
};

/** The meta row under the winning number (§7.5); 0 shows "—" for the null fields. */
export function resultMeta(result: SpinResult): Array<{ label: string; value: string }> {
  const dash = (v: string | number | null) => (v == null ? "—" : String(v));
  return [
    { label: "COLOR", value: result.color.toUpperCase() },
    { label: "ODD/EVEN", value: result.parity ? result.parity.toUpperCase() : "—" },
    { label: "LOW/HIGH", value: result.range ? (result.range === "low" ? "1-18" : "19-36") : "—" },
    { label: "DOZEN", value: dash(result.dozen) },
    { label: "COLUMN", value: dash(result.column) },
  ];
}
