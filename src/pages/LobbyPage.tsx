import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import { GAMES } from "@/constants/games";
import { BANKRUPTCY_THRESHOLD } from "@/constants/rates";
import type { GameInfo } from "@/types/game";
import type { Rate } from "@/types/casino";
import { PokerTable } from "@/components/casino/PokerTable";
import { GameCard } from "@/components/common/GameCard";
import { RateSelectModal } from "@/components/casino/RateSelectModal";
import { RescueModal } from "@/components/casino/RescueModal";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";

export function LobbyPage() {
  const navigate = useNavigate();
  const user = useCasinoStore((s) => s.user);
  const setRate = useCasinoStore((s) => s.setRate);
  const claimDailyBonus = useCasinoStore((s) => s.claimDailyBonus);
  const rescue = useCasinoStore((s) => s.rescue);
  const canClaimDailyBonus = useCasinoStore((s) => s.canClaimDailyBonus);
  const canRescue = useCasinoStore((s) => s.canRescue);
  const rescueCooldownMinutes = useCasinoStore((s) => s.rescueCooldownMinutes);

  const [rateGame, setRateGame] = useState<GameInfo | null>(null);
  const [comingSoon, setComingSoon] = useState<GameInfo | null>(null);
  const [rescueOpen, setRescueOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const chips = user?.chips ?? 0;
  const bankrupt = chips < BANKRUPTCY_THRESHOLD;

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const onSelectGame = (game: GameInfo) => {
    if (game.status === "comingSoon") {
      setComingSoon(game);
      return;
    }
    if (bankrupt) {
      setRescueOpen(true);
      return;
    }
    setRateGame(game);
  };

  const onConfirmRate = (rate: Rate) => {
    if (!rateGame) return;
    setRate(rate);
    const target = rateGame.path;
    setRateGame(null);
    navigate(target);
  };

  const onClaimDaily = () => {
    if (claimDailyBonus()) {
      flash("Daily bonus claimed! +1,000 chips");
      setRescueOpen(false);
    } else {
      flash("Daily bonus already claimed today.");
    }
  };

  const onRescue = () => {
    if (rescue()) {
      flash("Rescued! Chips topped up to 1,000.");
      setRescueOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-display text-3xl text-gold sm:text-4xl">Lobby</h1>
        <p className="text-sm text-white/60">Pick a card. Take a seat.</p>
      </div>

      {bankrupt && (
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm">
          <span className="text-red-200">You&apos;re below {BANKRUPTCY_THRESHOLD} chips.</span>
          <Button size="sm" variant="danger" onClick={() => setRescueOpen(true)}>
            Get Chips
          </Button>
        </div>
      )}

      <PokerTable caption="Casino Hub">
        {GAMES.map((game, i) => (
          <GameCard key={game.id} game={game} dealIndex={i} onSelect={onSelectGame} />
        ))}
      </PokerTable>

      {/* Action bar: daily bonus / profile / ranking */}
      <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-3">
        <Button
          variant={canClaimDailyBonus() ? "gold" : "ghost"}
          disabled={!canClaimDailyBonus()}
          onClick={onClaimDaily}
        >
          {canClaimDailyBonus() ? "🎁 Daily Bonus +1,000" : "Daily Bonus claimed"}
        </Button>
        <Button variant="ghost" onClick={() => navigate("/profile")}>
          Profile
        </Button>
        <Button
          variant="ghost"
          onClick={() => flash("Ranking needs a backend — coming after Supabase.")}
        >
          Ranking
        </Button>
      </div>

      {/* Rate selection */}
      <RateSelectModal
        open={rateGame !== null}
        game={rateGame}
        chips={chips}
        onClose={() => setRateGame(null)}
        onConfirm={onConfirmRate}
      />

      {/* Coming soon */}
      <Modal
        open={comingSoon !== null}
        onClose={() => setComingSoon(null)}
        title={comingSoon?.title ?? "Coming Soon"}
      >
        <p className="text-white/75">{comingSoon?.description}</p>
        <p className="mt-2 text-sm text-white/50">This game isn&apos;t available yet — check back soon.</p>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setComingSoon(null)}>Got it</Button>
        </div>
      </Modal>

      {/* Rescue / insufficient chips */}
      <RescueModal
        open={rescueOpen}
        chips={chips}
        canClaimDaily={canClaimDailyBonus()}
        canRescue={canRescue()}
        rescueCooldownMinutes={rescueCooldownMinutes()}
        onClose={() => setRescueOpen(false)}
        onClaimDaily={onClaimDaily}
        onRescue={onRescue}
      />

      {/* Toast */}
      {toast && (
        <div className="animate-fadeIn fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-gold-500/40 bg-black/85 px-5 py-2.5 text-sm text-gold shadow-gold">
          {toast}
        </div>
      )}
    </div>
  );
}
