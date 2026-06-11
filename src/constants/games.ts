// constants/games.ts — single source mapping GameId ↔ URL path ↔ lobby card. See spec §6, §7.3.
import type { GameId, GameInfo } from "@/types/game";

export const GAMES: readonly GameInfo[] = [
  {
    id: "neonjack",
    title: "NEON JACK",
    description: "Juggler-style pachislot. Fixed 3-medal bet, neon reels.",
    status: "comingSoon",
    cardRank: "A",
    cardSuit: "spade",
    path: "/games/neonjack",
  },
  {
    id: "holdem",
    title: "Texas Hold'em",
    description: "1 player vs 4 CPU. Pseudo-3D cash table.",
    status: "available",
    cardRank: "K",
    cardSuit: "heart",
    path: "/games/holdem",
  },
  {
    id: "roulette",
    title: "Roulette",
    description: "Place chips, spin the wheel, and resolve in one shot. Coming soon.",
    status: "comingSoon",
    cardRank: "Q",
    cardSuit: "diamond",
    path: "/games/roulette",
  },
  {
    id: "videoPoker",
    title: "Video Poker",
    description: "Jacks or Better (9/6). Hold & draw.",
    status: "available",
    cardRank: "J",
    cardSuit: "club",
    path: "/games/video-poker",
  },
];

export const GAME_BY_ID: Record<GameId, GameInfo> = Object.fromEntries(
  GAMES.map((g) => [g.id, g]),
) as Record<GameId, GameInfo>;

export function getGame(id: GameId): GameInfo {
  return GAME_BY_ID[id];
}
