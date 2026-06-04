import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import { VideoPokerGame } from "@/games/videoPoker/components/VideoPokerGame";
import { useStoreEconomy } from "@/games/shared/useStoreEconomy";
import { RescueModal } from "@/components/casino/RescueModal";
import { Button } from "@/components/common/Button";
import { ChipDisplay } from "@/components/common/ChipDisplay";

export function VideoPokerPage() {
  const navigate = useNavigate();
  const user = useCasinoStore((s) => s.user);
  const rate = useCasinoStore((s) => s.currentRate);
  const claimDailyBonus = useCasinoStore((s) => s.claimDailyBonus);
  const rescue = useCasinoStore((s) => s.rescue);
  const canClaimDailyBonus = useCasinoStore((s) => s.canClaimDailyBonus);
  const canRescue = useCasinoStore((s) => s.canRescue);
  const rescueCooldownMinutes = useCasinoStore((s) => s.rescueCooldownMinutes);
  const economy = useStoreEconomy("videoPoker");

  const [rescueOpen, setRescueOpen] = useState(false);

  if (!rate) return <Navigate to="/lobby" replace />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/lobby")}>
          ← Lobby
        </Button>
        <div className="flex items-center gap-2 text-sm text-white/60">
          <span className="font-display text-gold">{rate.label}</span>
          {user && <ChipDisplay chips={user.chips} size="sm" />}
        </div>
      </div>

      <h1 className="text-center font-display text-3xl text-gold">Video Poker</h1>

      <VideoPokerGame rate={rate} economy={economy} onInsufficient={() => setRescueOpen(true)} />

      <RescueModal
        open={rescueOpen}
        chips={user?.chips ?? 0}
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
