import { Link } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import { ChipDisplay } from "@/components/common/ChipDisplay";

/** Title screen (spec §7.1): brand, start, guest login, chips, and the honesty disclaimer. */
export function TitlePage() {
  const user = useCasinoStore((s) => s.user);
  const hydrated = useCasinoStore((s) => s.hydrated);

  return (
    <div className="casino-backdrop flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <div className="animate-fadeIn flex flex-col items-center gap-6">
        <div className="space-y-2">
          <h1 className="font-display text-5xl font-extrabold tracking-wide text-gold drop-shadow sm:text-7xl">
            CASINO&nbsp;HUB
          </h1>
          <p className="font-display text-lg tracking-[0.3em] text-white/70 sm:text-xl">
            FREE CASINO GAME SIMULATOR
          </p>
        </div>

        <p className="max-w-md text-sm text-white/70">
          Take a seat at the table. Play NEON JACK and Video Poker with free chips — pure simulation,
          no stakes.
        </p>

        {hydrated && user && (
          <div className="flex items-center gap-2 text-white/70">
            Welcome back, <span className="font-semibold text-white">{user.name}</span>
            <ChipDisplay chips={user.chips} size="sm" />
          </div>
        )}

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to={user ? "/lobby" : "/login"}
            className="focus-ring rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 px-10 py-3.5 text-lg font-bold text-wine-900 shadow-gold transition hover:brightness-110 active:scale-95"
          >
            {user ? "Enter Lobby" : "Start"}
          </Link>
          <Link
            to="/login"
            className="focus-ring rounded-2xl border border-white/20 px-8 py-3.5 text-white/85 transition hover:bg-white/10"
          >
            {user ? "Switch Player" : "Guest Login"}
          </Link>
        </div>

        <p className="mt-6 max-w-md rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs leading-relaxed text-white/55">
          ※本アプリは無料チップのみを使うシミュレーションであり、現金・換金・実際の賭博要素は一切ありません。
          <br />
          This app is a free, chips-only simulation. No real money, gambling, or cashout.
        </p>
      </div>
    </div>
  );
}
