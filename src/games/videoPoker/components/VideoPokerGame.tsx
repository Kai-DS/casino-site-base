import { useCallback, useEffect, useRef, useState } from "react";
import type { Rate } from "@/types/casino";
import type { RNG } from "@/types/card";
import type { GameEconomy } from "@/games/shared/economy";
import { useVideoPoker, type ActionResult } from "./useVideoPoker";
import type { DeckProvider } from "../logic/deckProvider";
import { CLASSIC_ROYAL_BONUS } from "../adapter";
import { formatChips } from "@/utils/format";
import { VideoPokerStatusPanel } from "./VideoPokerStatusPanel";
import { VideoPokerPaytable } from "./VideoPokerPaytable";
import { VideoPokerTable } from "./VideoPokerTable";
import { VideoPokerControls } from "./VideoPokerControls";
import { VideoPokerResultBanner } from "./VideoPokerResultBanner";

export type VideoPokerSessionSnapshot = {
  tableStack: number;
  canRebuy: boolean;
  rebuy: (newTableStack: number) => ActionResult;
};

type VideoPokerGameProps = {
  rate: Rate;
  economy: GameEconomy;
  onInsufficient: () => void;
  initialTableStack?: number;
  rng?: RNG;
  deckProvider?: DeckProvider;
  onSessionChange?: (session: VideoPokerSessionSnapshot) => void;
};

/** Casino-style Video Poker cabinet. Composes the status/paytable/table/controls (spec §12–§14). */
export function VideoPokerGame({
  rate,
  economy,
  onInsufficient,
  initialTableStack,
  rng,
  deckProvider,
  onSessionChange,
}: VideoPokerGameProps) {
  const vp = useVideoPoker(rate, economy, onInsufficient, { initialTableStack, rng, deckProvider });

  // UI animation lock (deal/replace), separate from the hook's synchronous resolution.
  const [uiAnimating, setUiAnimating] = useState(false);

  // Surface ActionResult failures as a transient toast (spec §25.2).
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
  }, []);

  const guard = useCallback(
    (result: ActionResult) => {
      if (!result.ok) flash(result.message);
    },
    [flash],
  );

  useEffect(() => {
    onSessionChange?.({ tableStack: vp.tableStack, canRebuy: vp.canRebuy, rebuy: vp.rebuy });
  }, [onSessionChange, vp.canRebuy, vp.rebuy, vp.tableStack]);

  // Hold the result reveal until the draw animation settles (spec §13.1).
  const showResult = vp.phase === "result" && !uiAnimating ? vp.lastResult : null;

  return (
    <div className="relative mx-auto w-full max-w-xl space-y-4 rounded-3xl border border-gold-500/25 bg-gradient-to-b from-neon-bg to-black p-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:p-6">
      <VideoPokerStatusPanel
        chips={economy.chips}
        tableStack={vp.tableStack}
        bet={vp.currentBet}
        coins={vp.coins}
        lastWin={showResult?.payout ?? null}
      />

      <VideoPokerPaytable
        coins={vp.coins}
        classicRoyalBonus={CLASSIC_ROYAL_BONUS}
        activeCategory={showResult?.category ?? null}
      />

      <VideoPokerTable
        hand={vp.hand}
        held={vp.held}
        phase={vp.phase}
        handId={vp.handId}
        winningCardIndexes={vp.winningCardIndexes}
        onAnimatingChange={setUiAnimating}
        onToggleHold={(i) => guard(vp.toggleHold(i))}
      />

      <VideoPokerResultBanner result={showResult} phase={vp.phase} />

      <VideoPokerControls
        coins={vp.coins}
        canChangeBet={vp.canChangeBet && !uiAnimating}
        canDeal={vp.canDeal && !uiAnimating}
        canDraw={vp.canDraw && !uiAnimating}
        phase={vp.phase}
        onSetCoins={(n) => guard(vp.setCoins(n))}
        onMaxBet={() => guard(vp.maxBet())}
        onDeal={() => guard(vp.deal())}
        onDraw={() => guard(vp.draw())}
      />

      <p className="text-center text-[11px] text-white/30">
        {rate.label} · 1 BET {formatChips(rate.betMin)} · MAX BET {formatChips(rate.betMax)} · Jacks
        or Better 9/6
      </p>

      {toast && (
        <div className="animate-fadeIn pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full border border-red-500/40 bg-black/85 px-4 py-2 text-sm text-red-200">
          {toast}
        </div>
      )}
    </div>
  );
}
