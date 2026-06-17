import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import { useStoreEconomy } from "@/games/shared/useStoreEconomy";
import { RouletteGame } from "@/components/roulette/RouletteGame";
import { useRouletteAnimationMode } from "@/components/roulette/useRouletteAnimationMode";
import { RescueModal } from "@/components/casino/RescueModal";

/**
 * Production Roulette table. The lobby's rate-select sets `currentRate` and `tableStack`; roulette
 * uses the store-owned stack as its spendable session cap, with chips/tableStack moving in lockstep.
 * The animation mode is the persisted user choice. flushPendingSettlement is wired to unmount so a
 * forced leave mid-spin still settles (the hook also self-flushes as the real backstop).
 */
export function RoulettePage() {
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
  const economy = useStoreEconomy("roulette");
  const { mode, setMode } = useRouletteAnimationMode();

  const flushRef = useRef<(() => void) | null>(null);
  const [rescueOpen, setRescueOpen] = useState(false);

  // Forced-leave guard (§2.3): settle any pending spin on unmount.
  useEffect(() => () => flushRef.current?.(), []);

  // No table chosen (e.g. a reload — currentRate/tableStack are runtime-only) → back to the lobby.
  if (!rate || stack === null) return <Navigate to="/lobby" replace />;

  const chips = user?.chips ?? 0;
  const exit = () => {
    flushRef.current?.();
    leaveTable();
    navigate("/lobby");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RouletteGame
        rate={rate}
        economy={economy}
        mode={mode}
        onModeChange={setMode}
        flushRef={flushRef}
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
