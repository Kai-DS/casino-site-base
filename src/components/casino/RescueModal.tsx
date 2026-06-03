import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { ChipDisplay } from "@/components/common/ChipDisplay";
import { RESCUE_AMOUNT } from "@/store/casinoStore";
import { formatChips } from "@/utils/format";
import { BANKRUPTCY_THRESHOLD } from "@/constants/rates";

type RescueModalProps = {
  open: boolean;
  chips: number;
  canClaimDaily: boolean;
  canRescue: boolean;
  rescueCooldownMinutes: number;
  onClose: () => void;
  onClaimDaily: () => void;
  onRescue: () => void;
};

/**
 * Insufficient-chips helper (spec §12.6): warn, offer the daily bonus, and — only
 * when even LOW (min {BANKRUPTCY_THRESHOLD}) is unreachable — a discreet Rescue.
 */
export function RescueModal({
  open,
  chips,
  canClaimDaily,
  canRescue,
  rescueCooldownMinutes,
  onClose,
  onClaimDaily,
  onRescue,
}: RescueModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Out of Chips" maxWidth="max-w-md">
      <div className="mb-4 flex items-center justify-center gap-2 text-white/80">
        Balance <ChipDisplay chips={chips} />
      </div>
      <p className="mb-5 text-sm text-white/70">
        You need at least {formatChips(BANKRUPTCY_THRESHOLD)} chips to sit at the cheapest table.
        Grab your daily bonus, or use a one-off rescue.
      </p>

      <div className="space-y-2.5">
        <Button
          variant="gold"
          className="w-full"
          disabled={!canClaimDaily}
          onClick={onClaimDaily}
        >
          {canClaimDaily ? "Claim Daily Bonus (+1,000)" : "Daily Bonus claimed today"}
        </Button>

        <Button
          variant="felt"
          className="w-full"
          disabled={!canRescue}
          onClick={onRescue}
        >
          {canRescue
            ? `Rescue Chips → ${formatChips(RESCUE_AMOUNT)}`
            : rescueCooldownMinutes > 0
              ? `Rescue available in ${rescueCooldownMinutes} min`
              : "Rescue unavailable"}
        </Button>
      </div>

      <p className="mt-4 text-center text-[11px] text-white/40">
        Free simulation only — chips have no monetary value.
      </p>
    </Modal>
  );
}
