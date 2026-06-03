// types/game.ts — see spec §10
export type GameId = "neonjack" | "holdem" | "omaha" | "videoPoker";

export type GameStatus = "available" | "comingSoon";

// Lobby decoration suit (includes "joker"); distinct from gameplay Suit (types/card.ts).
export type CardSuit = "spade" | "heart" | "diamond" | "club" | "joker";

export type GameInfo = {
  id: GameId;
  title: string;
  description: string;
  status: GameStatus;
  cardRank: string; // display only, e.g. "A" "K"
  cardSuit: CardSuit; // lobby decoration only
  path: string; // e.g. "/games/video-poker"
};

export type GameResult = {
  // one play's outcome (history / stats)
  id: string;
  userId: string;
  gameId: GameId;
  bet: number;
  payout: number;
  profit: number; // payout - bet
  playedAt: string; // ISO8601
};
