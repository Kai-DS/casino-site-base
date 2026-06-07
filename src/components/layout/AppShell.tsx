import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import { AppHeader } from "./AppHeader";

/** Common layout for authed routes: header + outlet, with a guest-login guard (spec §6). */
export function AppShell() {
  const hydrated = useCasinoStore((s) => s.hydrated);
  const user = useCasinoStore((s) => s.user);
  const location = useLocation();

  if (!hydrated) {
    return (
      <div className="casino-backdrop flex min-h-screen items-center justify-center">
        <span className="animate-pulse font-display text-xl text-gold-400/70">Loading…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="casino-backdrop flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full min-h-0 max-w-6xl flex-1 flex-col px-4 py-4">
        <Outlet />
      </main>
      <footer className="shrink-0 px-4 py-2 text-center text-[11px] text-white/35">
        CASINO HUB · Free simulation only — no real money, no cashout.
      </footer>
    </div>
  );
}
