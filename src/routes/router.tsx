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
import { RouletteSandbox } from "@/sandbox/roulette/RouletteSandbox";

// URLs are kebab-case; GameIds are camelCase — the mapping lives in constants/games.ts (spec §6).
export const router = createBrowserRouter([
  { path: "/", element: <TitlePage /> },
  { path: "/login", element: <LoginPage /> },
  // Isolated dev harness — no auth/lobby, mock economy. Same game logic as production.
  { path: "/sandbox/video-poker", element: <VideoPokerSandbox /> },
  { path: "/sandbox/texas-holdem", element: <TexasHoldemSandbox /> },
  { path: "/sandbox/roulette", element: <RouletteSandbox /> },
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
