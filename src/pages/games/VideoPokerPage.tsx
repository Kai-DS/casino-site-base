import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import {
  VideoPokerGame,
  type VideoPokerSessionSnapshot,
} from "@/games/videoPoker/components/VideoPokerGame";
import { useStoreEconomy } from "@/games/shared/useStoreEconomy";
import { RescueModal } from "@/components/casino/RescueModal";
import { RebuyModal } from "@/components/casino/RebuyModal";
import { Button } from "@/components/common/Button";

export function VideoPokerPage() {
  const navigate = useNavigate();
  const user = useCasinoStore((s) => s.user);
  const rate = useCasinoStore((s) => s.currentRate);
  const stack = useCasinoStore((s) => s.tableStack);
  const leaveTable = useCasinoStore((s) => s.leaveTable);
  const claimDailyBonus = useCasinoStore((s) => s.claimDailyBonus);
  const rescue = useCasinoStore((s) => s.rescue);
  const canClaimDailyBonus = useCasinoStore((s) => s.canClaimDailyBonus);
  const canRescue = useCasinoStore((s) => s.canRescue);
  const rescueCooldownMinutes = useCasinoStore((s) => s.rescueCooldownMinutes);
  const economy = useStoreEconomy("videoPoker", { syncTableStack: false });

  const [rescueOpen, setRescueOpen] = useState(false);
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const [runtimeStack, setRuntimeStack] = useState<number | null>(stack);
  const rebuyActionRef = useRef<VideoPokerSessionSnapshot["rebuy"] | null>(null);

  useEffect(() => {
    setRuntimeStack(stack);
    rebuyActionRef.current = null;
  }, [rate?.id, stack]);

  const onSessionChange = useCallback((session: VideoPokerSessionSnapshot) => {
    rebuyActionRef.current = session.rebuy;
    setRuntimeStack((current) => (current === session.tableStack ? current : session.tableStack));
  }, []);

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
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {/* Compact top bar */}
      <div className="flex shrink-0 items-center justify-between">
        <Button variant="ghost" size="sm" onClick={exit}>
          ← Lobby
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-display text-sm text-gold sm:text-base">Video Poker · {rate.label}</span>
          <Button variant="ghost" size="sm" onClick={() => setRebuyOpen(true)}>
            Re-buy
          </Button>
        </div>
      </div>

      {/* Cabinet fills the remaining height */}
      <div className="min-h-0 flex-1">
        <VideoPokerGame
          rate={rate}
          economy={economy}
          initialTableStack={runtimeStack ?? stack ?? undefined}
          onInsufficient={onInsufficient}
          onSessionChange={onSessionChange}
        />
      </div>

      <RebuyModal
        open={rebuyOpen}
        rate={rate}
        chips={chips}
        stack={runtimeStack}
        onClose={() => setRebuyOpen(false)}
        onRebuy={(amount) => {
          const result = rebuyActionRef.current?.(amount);
          if (result?.ok) {
            setRebuyOpen(false);
          } else if (result?.reason === "INSUFFICIENT_CHIPS") {
            setRebuyOpen(false);
            setRescueOpen(true);
          }
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
