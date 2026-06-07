import type { HandCategory } from "@/games/shared/poker/handEvaluator";
import { PAYTABLE, coinPayout, MAX_COINS, type CoinCount } from "../logic/payout";

type VideoPokerPaytableProps = {
  coins: CoinCount;
  classicRoyalBonus: boolean;
  activeCategory: HandCategory | "none" | null;
};

const COINS: CoinCount[] = [1, 2, 3, 4, 5];

/** Classic 1–5 coin × hand paytable across the top of the LCD (Game King style). */
export function VideoPokerPaytable({ coins, classicRoyalBonus, activeCategory }: VideoPokerPaytableProps) {
  return (
    <table className="w-full border-collapse text-right text-[10px] leading-none sm:text-[11px]">
      <tbody>
        {PAYTABLE.map((row) => {
          const active = activeCategory === row.category;
          return (
            <tr
              key={row.category}
              className={`border-b border-neon-green/15 ${active ? "bg-gold-500/15" : ""}`}
            >
              <td
                className={`whitespace-nowrap py-[3px] pl-1 text-left font-semibold uppercase tracking-wide ${
                  active ? "text-gold-300" : "text-gold-400/90"
                }`}
              >
                {row.label}
              </td>
              {COINS.map((coin) => {
                const isCurrentCol = coin === coins;
                const isRoyalMax =
                  row.category === "royal_flush" && coin === MAX_COINS && classicRoyalBonus;
                return (
                  <td
                    key={coin}
                    className={`w-[13%] py-[3px] tabular-nums ${
                      isRoyalMax
                        ? "font-bold text-neon-red [text-shadow:0_0_6px_rgba(255,59,92,0.6)]"
                        : isCurrentCol
                          ? "font-bold text-gold-300"
                          : "text-amber-200/45"
                    } ${isCurrentCol ? "bg-neon-green/10" : ""}`}
                  >
                    {coinPayout(row, coin, classicRoyalBonus)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
