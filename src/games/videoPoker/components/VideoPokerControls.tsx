import { MAX_COINS, type CoinCount } from "../logic/payout";

type VideoPokerControlsProps = {
  coins: CoinCount;
  canChangeBet: boolean;
  canDeal: boolean;
  canDraw: boolean;
  phase: "unseated" | "buyIn" | "ready" | "draw" | "result";
  onSetCoins: (n: number) => void;
  onMaxBet: () => void;
  onDeal: () => void;
  onDraw: () => void;
};

const COINS = Array.from({ length: MAX_COINS }, (_, i) => i + 1);

/** Physical-style button deck under the screen: coin selector + MAX BET + DEAL/DRAW (spec §14). */
export function VideoPokerControls({
  coins,
  canChangeBet,
  canDeal,
  canDraw,
  phase,
  onSetCoins,
  onMaxBet,
  onDeal,
  onDraw,
}: VideoPokerControlsProps) {
  const maxBet = coins >= MAX_COINS;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-1 py-1 sm:gap-3">
      <div className="flex items-center gap-1.5">
        {COINS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={!canChangeBet}
            onClick={() => onSetCoins(n)}
            aria-label={`Bet ${n} coin${n > 1 ? "s" : ""}`}
            aria-pressed={coins >= n}
            className={`focus-ring h-10 w-10 rounded-full border-2 text-sm font-black tabular-nums transition active:scale-95 disabled:opacity-40 ${
              coins >= n
                ? "border-gold-300 bg-gradient-to-b from-gold-400 to-gold-600 text-wine-900 shadow-gold"
                : "border-white/15 bg-black/40 text-white/50 hover:bg-white/10"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!canChangeBet}
        onClick={onMaxBet}
        className={`focus-ring h-12 rounded-xl border-2 px-4 text-sm font-black uppercase tracking-wide transition active:scale-95 disabled:opacity-40 ${
          maxBet
            ? "border-neon-green bg-neon-deepgreen text-neon-green shadow-neongreen"
            : "border-white/20 bg-black/40 text-white/70 hover:bg-white/10"
        }`}
      >
        Max Bet
      </button>

      {phase === "draw" ? (
        <button
          type="button"
          disabled={!canDraw}
          onClick={onDraw}
          className="focus-ring h-12 w-44 rounded-xl border-2 border-emerald-300 bg-gradient-to-b from-emerald-400 to-emerald-600 text-lg font-black uppercase tracking-widest text-emerald-950 shadow-neongreen transition active:scale-95 disabled:opacity-40"
        >
          Draw
        </button>
      ) : (
        <button
          type="button"
          disabled={!canDeal}
          onClick={onDeal}
          className="focus-ring h-12 w-44 rounded-xl border-2 border-gold-300 bg-gradient-to-b from-gold-400 to-gold-600 text-lg font-black uppercase tracking-widest text-wine-900 shadow-gold transition active:scale-95 disabled:from-neutral-600 disabled:to-neutral-800 disabled:opacity-50"
        >
          Deal
        </button>
      )}
    </div>
  );
}
