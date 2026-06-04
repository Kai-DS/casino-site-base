import type { Rate } from "@/types/casino";
import { useVideoPoker } from "./useVideoPoker";
import { PAYTABLE } from "../logic/payout";
import { CardFace } from "@/components/casino/CardFace";
import { Button } from "@/components/common/Button";
import { formatChips } from "@/utils/format";
import { MAX_COINS } from "@/constants/rates";
import { CLASSIC_ROYAL_BONUS, ROYAL_MAX_BET_COINS } from "../adapter";
import type { GameEconomy } from "@/games/shared/economy";

type VideoPokerGameProps = {
  rate: Rate;
  economy: GameEconomy;
  onInsufficient: () => void;
};

/** Per-coin payout for a paytable line at the current coin count (handles the Royal max-bet jump). */
function payoutForLine(line: { label: string; multiplier: number }, rate: Rate, coins: number): number {
  if (CLASSIC_ROYAL_BONUS && line.label === "Royal Flush" && coins >= MAX_COINS) {
    return ROYAL_MAX_BET_COINS * rate.betMin;
  }
  return line.multiplier * rate.betMin * coins;
}

export function VideoPokerGame({ rate, economy, onInsufficient }: VideoPokerGameProps) {
  const vp = useVideoPoker(rate, economy, onInsufficient);
  const { hand, held, phase, lastLine, lastPayout, coins, bet, canDeal, canDraw, canChangeBet } = vp;

  const won = lastPayout != null && lastPayout > 0;
  const maxBet = coins >= MAX_COINS;

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      {/* Paytable — shows the payout for the currently selected bet */}
      <div className="overflow-hidden rounded-xl border border-gold-500/30 bg-black/40">
        <ul className="divide-y divide-white/5 p-2 text-sm">
          {PAYTABLE.map((line) => {
            const active = lastLine?.label === line.label;
            const royalBoost = line.label === "Royal Flush" && maxBet && CLASSIC_ROYAL_BONUS;
            return (
              <li
                key={line.label}
                className={`flex items-center justify-between rounded px-2 py-1 ${
                  active ? "bg-gold-500/20 font-bold text-gold" : "text-white/70"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {line.label}
                  {royalBoost && (
                    <span className="rounded bg-neon-red/20 px-1 text-[10px] font-bold text-neon-red">
                      MAX
                    </span>
                  )}
                </span>
                <span className={`tabular-nums ${royalBoost ? "text-neon-red" : "text-gold-400"}`}>
                  {formatChips(payoutForLine(line, rate, coins))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Hand */}
      <div className="flex justify-center gap-2 sm:gap-3">
        {hand.map((card, i) => (
          <button
            key={i}
            type="button"
            disabled={phase !== "draw"}
            onClick={() => vp.toggleHold(i)}
            aria-label={held[i] ? `Held card ${i + 1}` : `Hold card ${i + 1}`}
            className="focus-ring w-[18%] max-w-[5.5rem] rounded-lg disabled:cursor-default"
          >
            <CardFace card={card} faceDown={!card} held={held[i] ?? false} />
          </button>
        ))}
      </div>

      {/* Result line */}
      <div className="flex h-8 items-center justify-center">
        {lastLine ? (
          <span className={`font-display text-xl ${won ? "text-gold" : "text-white/40"}`}>
            {lastLine.label}
            {won && ` · +${formatChips(lastPayout)}`}
          </span>
        ) : (
          <span className="text-white/30">
            {phase === "draw" ? "Tap cards to HOLD, then DRAW" : "Choose your bet, then DEAL"}
          </span>
        )}
      </div>

      {/* Bet selector */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: MAX_COINS }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={!canChangeBet}
            onClick={() => vp.setCoins(n)}
            aria-label={`Bet ${n} coin${n > 1 ? "s" : ""}`}
            className={`focus-ring h-9 w-9 rounded-full border text-sm font-bold tabular-nums transition disabled:opacity-50 ${
              coins >= n
                ? "border-gold-500 bg-gradient-to-b from-gold-400 to-gold-600 text-wine-900"
                : "border-white/20 text-white/50 hover:bg-white/10"
            }`}
          >
            {n}
          </button>
        ))}
        <Button size="sm" variant={maxBet ? "neon" : "ghost"} disabled={!canChangeBet} onClick={vp.betMax}>
          MAX BET
        </Button>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <div className="text-xs text-white/50">
          BET <span className="font-bold text-gold">{formatChips(bet)}</span>
          <span className="ml-1 text-white/30">({coins} coin{coins > 1 ? "s" : ""})</span>
        </div>
        {canDraw ? (
          <Button variant="neon" size="lg" onClick={vp.draw}>
            DRAW
          </Button>
        ) : (
          <Button variant="gold" size="lg" disabled={!canDeal} onClick={vp.deal}>
            DEAL
          </Button>
        )}
      </div>

      <p className="text-center text-[11px] text-white/30">
        {rate.label} · 1 BET {formatChips(rate.betMin)} · MAX BET {formatChips(rate.betMax)} · Jacks
        or Better 9/6
      </p>
    </div>
  );
}
