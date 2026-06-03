import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCasinoStore } from "@/store/casinoStore";
import { Button } from "@/components/common/Button";
import { STARTING_CHIPS } from "@/repositories/userRepository";
import { formatChips } from "@/utils/format";

/** Guest login (spec §7.2): name only, creates a UserProfile with starting chips. */
export function LoginPage() {
  const login = useCasinoStore((s) => s.login);
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(name);
    navigate("/lobby", { replace: true });
  };

  return (
    <div className="casino-backdrop flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <form
        onSubmit={onSubmit}
        className="animate-fadeIn w-full max-w-sm space-y-5 rounded-2xl border border-gold-500/30 bg-wine-800/80 p-7 shadow-2xl"
      >
        <div className="text-center">
          <h1 className="font-display text-3xl text-gold">Guest Login</h1>
          <p className="mt-1 text-sm text-white/60">
            Start with {formatChips(STARTING_CHIPS)} free chips.
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-white/70">Player name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={24}
            autoFocus
            className="focus-ring w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white placeholder-white/30"
          />
        </label>

        <Button type="submit" variant="gold" size="lg" className="w-full">
          Enter Casino
        </Button>

        <p className="text-center text-xs text-white/40">
          No password, no account. Your progress is saved locally on this device.
        </p>
        <div className="text-center">
          <Link to="/" className="focus-ring rounded text-sm text-white/50 hover:text-white/80">
            ← Back to title
          </Link>
        </div>
      </form>
    </div>
  );
}
