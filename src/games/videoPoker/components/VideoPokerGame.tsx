import type { Rate } from "@/types/casino";
import { useVideoPoker } from "./useVideoPoker";
import { PAYTABLE } from "../logic/payout";
import { CardFace } from "@/components/casino/CardFace";
import { Button } from "@/components/common/Button";
import { formatChips } from "@/utils/format";

type VideoPokerGameProps = {
  rate: Rate;
  onInsufficient: () => void;
};

export function VideoPokerGame({ rate, onInsufficient }: VideoPokerGameProps) {
  const { hand, held, phase, lastLine, bet, canDeal, canDraw, deal, draw, toggleHold } =
    useVideoPoker(rate, onInsufficient);

  const won = lastLine && lastLine.multiplier > 0;

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      {/* Paytable */}
      <div className="overflow-hidden rounded-xl border border-gold-500/30 bg-black/40">
        <div className="grid grid-cols-3 gap-x-2 p-3 text-xs sm:text-sm">
          {PAYTABLE.map((line) => {
            const active = lastLine?.label === line.label;
            return (
              <div
                key={line.label}
                className={`flex items-center justify-between rounded px-2 py-0.5 ${
                  active ? "bg-gold-500/20 font-bold text-gold" : "text-white/70"
                }`}
              >
                <span className="truncate">{line.label}</span>
                <span className="tabular-nums text-gold-400">×{line.multiplier}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hand */}
      <div className="flex justify-center gap-2 sm:gap-3">
        {hand.map((card, i) => (
          <button
            key={i}
            type="button"
            disabled={phase !== "draw"}
            onClick={() => toggleHold(i)}
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
            {won && ` · +${formatChips(lastLine.multiplier * rate.betUnit)}`}
          </span>
        ) : (
          <span className="text-white/30">
            {phase === "draw" ? "Tap cards to HOLD, then DRAW" : "Press DEAL"}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <div className="text-xs text-white/50">
          BET <span className="font-bold text-gold">{formatChips(bet)}</span>
        </div>
        {canDraw ? (
          <Button variant="neon" size="lg" onClick={draw}>
            DRAW
          </Button>
        ) : (
          <Button variant="gold" size="lg" disabled={!canDeal} onClick={deal}>
            DEAL
          </Button>
        )}
      </div>

      <p className="text-center text-[11px] text-white/30">
        Rate {rate.label} · base bet {formatChips(rate.betUnit)} · Jacks or Better 9/6
      </p>
    </div>
  );
}
