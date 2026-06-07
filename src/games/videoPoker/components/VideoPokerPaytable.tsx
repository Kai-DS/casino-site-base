import type { HandCategory } from "@/games/shared/poker/handEvaluator";
import { PAYTABLE, coinPayout, MAX_COINS, type CoinCount } from "../logic/payout";

type VideoPokerPaytableProps = {
  coins: CoinCount;
  classicRoyalBonus: boolean;
  activeCategory: HandCategory | "none" | null;
};

const COINS: CoinCount[] = [1, 2, 3, 4, 5];

/** Classic 1–5 coin × hand paytable. Highlights the current coin column, the won row, and the RF MAX cell. */
export function VideoPokerPaytable({ coins, classicRoyalBonus, activeCategory }: VideoPokerPaytableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gold-500/30 bg-gradient-to-b from-neon-deep/60 to-black/70">
      <table className="w-full min-w-[20rem] border-collapse text-right text-[11px] sm:text-xs">
        <thead>
          <tr className="text-white/40">
            <th className="px-2 py-1 text-left font-medium">Hand</th>
            {COINS.map((coin) => (
              <th
                key={coin}
                className={`px-2 py-1 font-medium ${coin === coins ? "text-gold" : ""}`}
              >
                {coin === MAX_COINS ? "MAX" : coin}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PAYTABLE.map((row) => {
            const active = activeCategory === row.category;
            return (
              <tr
                key={row.category}
                className={`border-t border-white/5 ${active ? "bg-gold-500/20 font-bold" : ""}`}
              >
                <td className={`px-2 py-1 text-left ${active ? "text-gold" : "text-white/75"}`}>{row.label}</td>
                {COINS.map((coin) => {
                  const isCurrentCol = coin === coins;
                  const isRoyalMax =
                    row.category === "royal_flush" && coin === MAX_COINS && classicRoyalBonus;
                  return (
                    <td
                      key={coin}
                      className={`px-2 py-1 tabular-nums ${
                        isRoyalMax
                          ? "font-bold text-neon-red"
                          : isCurrentCol
                            ? "text-gold"
                            : "text-white/55"
                      } ${isCurrentCol ? "bg-white/5" : ""}`}
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
    </div>
  );
}
