import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import { NeonJackGame } from "@/games/neonjack/components/NeonJackGame";
import { RescueModal } from "@/components/casino/RescueModal";
import { RebuyModal } from "@/components/casino/RebuyModal";
import { StackBar } from "@/components/casino/StackBar";
import { Button } from "@/components/common/Button";

export function NeonJackPage() {
  const navigate = useNavigate();
  const user = useCasinoStore((s) => s.user);
  const rate = useCasinoStore((s) => s.currentRate);
  const stack = useCasinoStore((s) => s.tableStack);
  const rebuy = useCasinoStore((s) => s.rebuy);
  const leaveTable = useCasinoStore((s) => s.leaveTable);
  const claimDailyBonus = useCasinoStore((s) => s.claimDailyBonus);
  const rescue = useCasinoStore((s) => s.rescue);
  const canClaimDailyBonus = useCasinoStore((s) => s.canClaimDailyBonus);
  const canRescue = useCasinoStore((s) => s.canRescue);
  const rescueCooldownMinutes = useCasinoStore((s) => s.rescueCooldownMinutes);

  const [rescueOpen, setRescueOpen] = useState(false);
  const [rebuyOpen, setRebuyOpen] = useState(false);

  if (!rate) return <Navigate to="/lobby" replace />;

  const chips = user?.chips ?? 0;

  const exit = () => {
    leaveTable();
    navigate("/lobby");
  };

  const onInsufficient = () => {
    if (chips >= rate.buyInMin) setRebuyOpen(true);
    else setRescueOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={exit}>
          ← Lobby
        </Button>
        <span className="font-display text-gold">{rate.label}</span>
      </div>

      <h1 className="text-center font-display text-3xl text-neon-blue drop-shadow-[0_0_10px_rgba(40,215,255,0.6)]">
        NEON&nbsp;JACK
      </h1>

      <StackBar rate={rate} chips={chips} stack={stack} onRebuy={() => setRebuyOpen(true)} />

      <NeonJackGame rate={rate} onInsufficient={onInsufficient} />

      <RebuyModal
        open={rebuyOpen}
        rate={rate}
        chips={chips}
        stack={stack}
        onClose={() => setRebuyOpen(false)}
        onRebuy={(amount) => {
          if (rebuy(amount)) setRebuyOpen(false);
        }}
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
