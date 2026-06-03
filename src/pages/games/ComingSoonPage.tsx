import { useNavigate } from "react-router-dom";
import type { GameId } from "@/types/game";
import { GAME_BY_ID } from "@/constants/games";
import { Button } from "@/components/common/Button";
import { PlayingCard } from "@/components/casino/PlayingCard";

/** Placeholder route for not-yet-implemented games (router's ComingSoonOrPage, spec §6). */
export function ComingSoonPage({ id }: { id: GameId }) {
  const navigate = useNavigate();
  const game = GAME_BY_ID[id];

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <div className="w-28">
        <PlayingCard rank={game.cardRank} suit={game.cardSuit} dimmed />
      </div>
      <h1 className="font-display text-3xl text-gold">{game.title}</h1>
      <p className="max-w-sm text-white/65">{game.description}</p>
      <span className="rounded-full bg-black/50 px-4 py-1 text-xs font-bold uppercase tracking-wide text-gold">
        Coming Soon
      </span>
      <Button variant="ghost" onClick={() => navigate("/lobby")}>
        ← Back to Lobby
      </Button>
    </div>
  );
}
