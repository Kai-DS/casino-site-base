import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { ChipDisplay } from "@/components/common/ChipDisplay";
import { BuyInControl } from "./BuyInControl";
import { RATES, canAfford, clampBuyIn } from "@/constants/rates";
import type { Rate } from "@/types/casino";
import type { GameInfo } from "@/types/game";
import { formatChips } from "@/utils/format";

type RateSelectModalProps = {
  open: boolean;
  game: GameInfo | null;
  chips: number;
  onClose: () => void;
  /** Confirmed with the chosen rate and buy-in amount (spec §7.5, §8). */
  onConfirm: (rate: Rate, buyIn: number) => void;
};

/** Two steps: pick a rate (gated by buyInMin) → choose how much to bring to the table. */
export function RateSelectModal({ open, game, chips, onClose, onConfirm }: RateSelectModalProps) {
  const [picked, setPicked] = useState<Rate | null>(null);
  const [amount, setAmount] = useState(0);

  // Reset to step 1 whenever the modal (re)opens.
  useEffect(() => {
    if (open) {
      setPicked(null);
      setAmount(0);
    }
  }, [open]);

  const choose = (rate: Rate) => {
    setPicked(rate);
    setAmount(clampBuyIn(rate, rate.buyInMin, chips)); // default to the minimum buy-in
  };

  const title = picked
    ? `${picked.label} — Buy-in`
    : game
      ? `${game.title} — Select Rate`
      : "Select Rate";

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-lg">
      <div className="mb-3 flex items-center justify-end gap-2 text-sm text-white/60">
        Wallet <ChipDisplay chips={chips} size="sm" />
      </div>

      {!picked ? (
        <>
          <p className="mb-3 text-sm text-white/70">
            You can sit at any table whose <strong className="text-gold">buy-in min</strong> you can
            afford.
          </p>
          <ul className="grid grid-cols-2 gap-3">
            {RATES.map((rate) => {
              const eligible = canAfford(rate, chips);
              return (
                <li key={rate.id}>
                  <button
                    type="button"
                    disabled={!eligible}
                    onClick={() => choose(rate)}
                    className={`focus-ring flex w-full flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition ${
                      eligible
                        ? "border-gold-500/50 bg-felt-800 hover:bg-felt-700 hover:shadow-gold"
                        : "cursor-not-allowed border-white/10 bg-black/30 opacity-50"
                    }`}
                  >
                    <span className="font-display text-xl text-gold">{rate.label}</span>
                    <span className="text-xs text-white/70">
                      buy-in {formatChips(rate.buyInMin)}–{formatChips(rate.buyInMax)}
                    </span>
                    <span className="text-[11px] text-white/45">
                      bet {formatChips(rate.betMin)}–{formatChips(rate.betMax)} · {rate.blurb}
                    </span>
                    {!eligible && (
                      <span className="text-[11px] font-semibold text-red-300">
                        Need {formatChips(rate.buyInMin)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <BuyInControl rate={picked} chips={chips} value={amount} onChange={setAmount} />
          <div className="mt-5 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
              ← Rates
            </Button>
            <Button variant="gold" onClick={() => onConfirm(picked, amount)}>
              Sit · Bring {formatChips(amount)}
            </Button>
          </div>
        </>
      )}

      {!picked && (
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      )}
    </Modal>
  );
}
