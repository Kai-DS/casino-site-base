import { Button } from "@/components/common/Button";
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

/** Bet selector (1–5 coins) + MAX BET, plus the primary DEAL/DRAW action (spec §14 Controls). */
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
    <div className="space-y-3">
      {/* Coin selector */}
      <div className="flex items-center justify-center gap-2">
        {COINS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={!canChangeBet}
            onClick={() => onSetCoins(n)}
            aria-label={`Bet ${n} coin${n > 1 ? "s" : ""}`}
            aria-pressed={coins >= n}
            className={`focus-ring h-9 w-9 rounded-full border text-sm font-bold tabular-nums transition disabled:opacity-50 ${
              coins >= n
                ? "border-gold-500 bg-gradient-to-b from-gold-400 to-gold-600 text-wine-900 shadow-gold"
                : "border-white/20 text-white/50 hover:bg-white/10"
            }`}
          >
            {n}
          </button>
        ))}
        <Button size="sm" variant={maxBet ? "neon" : "ghost"} disabled={!canChangeBet} onClick={onMaxBet}>
          MAX BET
        </Button>
      </div>

      {/* Primary action */}
      <div className="flex justify-center">
        {phase === "draw" ? (
          <Button variant="neon" size="lg" disabled={!canDraw} onClick={onDraw} className="w-48">
            DRAW
          </Button>
        ) : (
          <Button variant="gold" size="lg" disabled={!canDeal} onClick={onDeal} className="w-48">
            DEAL
          </Button>
        )}
      </div>
    </div>
  );
}
