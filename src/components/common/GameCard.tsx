import type { GameInfo } from "@/types/game";
import { PlayingCard } from "@/components/casino/PlayingCard";

type GameCardProps = {
  game: GameInfo;
  /** Stagger index for the deal animation. */
  dealIndex?: number;
  onSelect: (game: GameInfo) => void;
};

/** A dealt trump card on the felt that opens a game (or the Coming Soon modal). */
export function GameCard({ game, dealIndex = 0, onSelect }: GameCardProps) {
  const comingSoon = game.status === "comingSoon";

  return (
    <button
      type="button"
      onClick={() => onSelect(game)}
      aria-label={`${game.title}${comingSoon ? " (coming soon)" : ""}`}
      style={{ animationDelay: `${dealIndex * 120}ms` }}
      className="group focus-ring animate-deal relative block w-[clamp(5.5rem,22vw,8rem)] rounded-xl transition-transform duration-200 hover:-translate-y-2.5 focus-visible:-translate-y-2.5"
    >
      <PlayingCard rank={game.cardRank} suit={game.cardSuit} dimmed={comingSoon} />

      {/* title plate */}
      <span className="mt-2 block text-center text-xs font-semibold tracking-wide text-white drop-shadow sm:text-sm">
        {game.title}
      </span>

      {comingSoon && (
        <span className="absolute right-1 top-1 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
          Soon
        </span>
      )}
    </button>
  );
}
