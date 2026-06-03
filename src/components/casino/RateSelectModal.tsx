import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { ChipDisplay } from "@/components/common/ChipDisplay";
import { RATES } from "@/constants/rates";
import type { Rate } from "@/types/casino";
import type { GameInfo } from "@/types/game";
import { formatChips } from "@/utils/format";

type RateSelectModalProps = {
  open: boolean;
  game: GameInfo | null;
  chips: number;
  onClose: () => void;
  onConfirm: (rate: Rate) => void;
};

/** Every game starts by passing through this 4-tier rate gate (spec §7.5, §8). */
export function RateSelectModal({ open, game, chips, onClose, onConfirm }: RateSelectModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={game ? `${game.title} — Select Rate` : "Select Rate"} maxWidth="max-w-lg">
      <p className="mb-4 text-sm text-white/70">
        <strong className="text-gold">minBalance</strong> is the entry gate (never deducted).{" "}
        <strong className="text-gold">betUnit</strong> scales each bet.
      </p>

      <div className="mb-2 flex items-center justify-end gap-2 text-sm text-white/60">
        Balance <ChipDisplay chips={chips} size="sm" />
      </div>

      <ul className="grid grid-cols-2 gap-3">
        {RATES.map((rate) => {
          const locked = chips < rate.minBalance;
          return (
            <li key={rate.id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onConfirm(rate)}
                className={`focus-ring flex w-full flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                  locked
                    ? "cursor-not-allowed border-white/10 bg-black/30 opacity-50"
                    : "border-gold-500/50 bg-felt-800 hover:bg-felt-700 hover:shadow-gold"
                }`}
              >
                <span className="font-display text-xl text-gold">{rate.label}</span>
                <span className="text-xs text-white/70">
                  min {formatChips(rate.minBalance)} · ×{rate.betUnit}
                </span>
                {locked && <span className="text-[11px] font-semibold text-red-300">Need {formatChips(rate.minBalance)}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
