import { createBrowserRouter } from "react-router-dom";
import { TitlePage } from "@/pages/TitlePage";
import { LoginPage } from "@/pages/LoginPage";
import { LobbyPage } from "@/pages/LobbyPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { VideoPokerPage } from "@/pages/games/VideoPokerPage";
import { TexasHoldemPage } from "@/pages/games/TexasHoldemPage";
import { RoulettePage } from "@/pages/games/RoulettePage";
import { ComingSoonPage } from "@/pages/games/ComingSoonPage";
import { AppShell } from "@/components/layout/AppShell";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";
import { VideoPokerSandbox } from "@/sandbox/videoPoker/VideoPokerSandbox";
import { TexasHoldemSandbox } from "@/sandbox/texasHoldem/TexasHoldemSandbox";

type RouletteSandboxEnv = Pick<ImportMetaEnv, "DEV">;

export function rouletteSandboxRouteEnabled(env: RouletteSandboxEnv = import.meta.env): boolean {
  return env.DEV;
}

const rouletteSandboxRoutes = import.meta.env.DEV
  ? [
      {
        path: "/sandbox/roulette",
        lazy: async () => {
          const { RouletteSandbox } = await import("@/sandbox/roulette/RouletteSandbox");
          return { Component: RouletteSandbox };
        },
      },
    ]
  : [];

// URLs are kebab-case; GameIds are camelCase — the mapping lives in constants/games.ts (spec §6).
export const router = createBrowserRouter([
  { path: "/", element: <TitlePage /> },
  { path: "/login", element: <LoginPage /> },
  // Isolated dev harness — no auth/lobby, mock economy. Same game logic as production.
  { path: "/sandbox/video-poker", element: <VideoPokerSandbox /> },
  { path: "/sandbox/texas-holdem", element: <TexasHoldemSandbox /> },
  ...rouletteSandboxRoutes,
  {
    element: <AppShell />, // shared header/layout + guest-login guard
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/lobby", element: <LobbyPage /> },
      { path: "/profile", element: <ProfilePage /> },
      { path: "/games/neonjack", element: <ComingSoonPage id="neonjack" /> },
      { path: "/games/video-poker", element: <VideoPokerPage /> },
      { path: "/games/holdem", element: <TexasHoldemPage /> },
      { path: "/games/roulette", element: <RoulettePage /> },
    ],
  },
  { path: "*", element: <RouteErrorBoundary /> },
]);
