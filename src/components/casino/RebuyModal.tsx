import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { BuyInControl } from "./BuyInControl";
import { clampBuyIn } from "@/constants/rates";
import type { Rate } from "@/types/casino";
import { formatChips } from "@/utils/format";

type RebuyModalProps = {
  open: boolean;
  rate: Rate;
  chips: number;
  stack: number | null;
  onClose: () => void;
  onRebuy: (amount: number) => void;
};

/** Top up the table stack within [buyInMin, min(buyInMax, chips)] when it runs low. */
export function RebuyModal({ open, rate, chips, stack, onClose, onRebuy }: RebuyModalProps) {
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (open) setAmount(clampBuyIn(rate, rate.buyInMin, chips));
  }, [open, rate, chips]);

  const broke = chips < rate.buyInMin;

  return (
    <Modal open={open} onClose={onClose} title={`${rate.label} — Re-buy`}>
      <p className="mb-4 text-sm text-white/70">
        Table stack: <span className="font-semibold text-white">{formatChips(stack ?? 0)}</span>. Bring
        more chips to keep playing.
      </p>

      {broke ? (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-3 text-sm text-red-200">
          Not enough chips to re-buy this table (need {formatChips(rate.buyInMin)}). Drop to a lower
          rate or claim your daily bonus.
        </p>
      ) : (
        <BuyInControl rate={rate} chips={chips} value={amount} onChange={setAmount} />
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        {!broke && (
          <Button variant="gold" onClick={() => onRebuy(amount)}>
            Re-buy {formatChips(amount)}
          </Button>
        )}
      </div>
    </Modal>
  );
}
