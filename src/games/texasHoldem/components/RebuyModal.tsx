// games/texasHoldem/components/RebuyModal.tsx
// Re-buy / top-up the table stack between hands (spec §6). SET method: you choose the new
// stack total in [buyInMin, min(buyInMax, chips)] and chips are NOT deducted here — the logic's
// rebuy() applies it. Reuses the shared BuyInControl so the buy-in feel matches the lobby.
import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { BuyInControl } from "@/components/casino/BuyInControl";
import { clampBuyIn } from "@/constants/rates";
import { formatChips } from "@/utils/format";
import type { Rate } from "../types";

type RebuyModalProps = {
  open: boolean;
  rate: Rate;
  chips: number;
  stack: number;
  onClose: () => void;
  onRebuy: (newTableStack: number) => void;
};

export function RebuyModal({ open, rate, chips, stack, onClose, onRebuy }: RebuyModalProps) {
  const [amount, setAmount] = useState(() => clampBuyIn(rate, rate.buyInMin, chips));

  useEffect(() => {
    if (open) setAmount(clampBuyIn(rate, Math.max(rate.buyInMin, stack), chips));
  }, [open, rate, chips, stack]);

  const broke = chips < rate.buyInMin;

  return (
    <Modal open={open} onClose={onClose} title={`${rate.label} — Re-buy`}>
      <p className="mb-4 text-sm text-white/70">
        Table stack: <span className="font-semibold text-white">{formatChips(stack)}</span>. Set a new
        stack to bring to the table. Your chips are not spent until you bet.
      </p>

      {broke ? (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-3 text-sm text-red-200">
          Not enough chips to re-buy this table (need {formatChips(rate.buyInMin)}). Drop to a lower rate.
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
            Re-buy to {formatChips(amount)}
          </Button>
        )}
      </div>
    </Modal>
  );
}
