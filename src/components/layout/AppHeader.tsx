import { Link, useNavigate } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import { ChipDisplay } from "@/components/common/ChipDisplay";

/** Shared header: brand, chip balance, profile + user-switch links (spec §7.3). */
export function AppHeader() {
  const user = useCasinoStore((s) => s.user);
  const logout = useCasinoStore((s) => s.logout);
  const navigate = useNavigate();

  const onSwitchUser = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gold-500/20 bg-wine-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/lobby" className="focus-ring rounded font-display text-xl font-extrabold tracking-wide text-gold">
          CASINO&nbsp;HUB
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {user && <ChipDisplay chips={user.chips} />}
          {user && (
            <Link
              to="/profile"
              className="focus-ring hidden rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 sm:inline-flex"
            >
              {user.name}
            </Link>
          )}
          <button
            type="button"
            onClick={onSwitchUser}
            className="focus-ring rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
          >
            Switch
          </button>
        </div>
      </div>
    </header>
  );
}
