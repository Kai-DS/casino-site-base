import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import { useStoreEconomy } from "@/games/shared/useStoreEconomy";
import { TexasHoldemGame } from "@/games/texasHoldem/components/TexasHoldemGame";
import { RescueModal } from "@/components/casino/RescueModal";

/**
 * Production Texas Hold'em table. The lobby's rate-select + buy-in set `currentRate` /
 * `tableStack`; this page binds the real casino economy and lets the game auto-seat with that
 * stack. chips are the single source of truth — the hook owns the on-table stack, so the store
 * economy runs with `syncTableStack: false` (no double-decrement). Rescue/daily-bonus are wired
 * for the bankrupt path (spec §31).
 */
export function TexasHoldemPage() {
  const navigate = useNavigate();
  const rate = useCasinoStore((s) => s.currentRate);
  const stack = useCasinoStore((s) => s.tableStack);
  const user = useCasinoStore((s) => s.user);
  const leaveTable = useCasinoStore((s) => s.leaveTable);
  const claimDailyBonus = useCasinoStore((s) => s.claimDailyBonus);
  const rescue = useCasinoStore((s) => s.rescue);
  const canClaimDailyBonus = useCasinoStore((s) => s.canClaimDailyBonus);
  const canRescue = useCasinoStore((s) => s.canRescue);
  const rescueCooldownMinutes = useCasinoStore((s) => s.rescueCooldownMinutes);
  const economy = useStoreEconomy("holdem", { syncTableStack: false });

  const [rescueOpen, setRescueOpen] = useState(false);

  // No table chosen (e.g. a reload — tableStack is runtime-only, spec §5.2) → back to the lobby.
  if (!rate) return <Navigate to="/lobby" replace />;

  const chips = user?.chips ?? 0;
  const exit = () => {
    leaveTable();
    navigate("/lobby");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TexasHoldemGame
        rate={rate}
        economy={economy}
        initialBuyIn={stack ?? undefined}
        onExit={exit}
        onRequestRescue={() => setRescueOpen(true)}
      />

      <RescueModal
        open={rescueOpen}
        chips={chips}
        canClaimDaily={canClaimDailyBonus()}
        canRescue={canRescue()}
        rescueCooldownMinutes={rescueCooldownMinutes()}
        onClose={() => setRescueOpen(false)}
        onClaimDaily={() => {
          if (claimDailyBonus()) setRescueOpen(false);
        }}
        onRescue={() => {
          if (rescue()) setRescueOpen(false);
        }}
      />
    </div>
  );
}
