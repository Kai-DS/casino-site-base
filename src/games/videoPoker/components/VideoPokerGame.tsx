import { useCallback, useEffect, useRef, useState } from "react";
import type { Rate } from "@/types/casino";
import type { RNG } from "@/types/card";
import type { GameEconomy } from "@/games/shared/economy";
import { useVideoPoker, type ActionResult } from "./useVideoPoker";
import type { DeckProvider } from "../logic/deckProvider";
import { CLASSIC_ROYAL_BONUS } from "../adapter";
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

/** Video Poker cabinet: a glowing LCD screen (meter + paytable + cards + result) over physical controls. */
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

  const [uiAnimating, setUiAnimating] = useState(false);

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

  const showResult = vp.phase === "result" && !uiAnimating ? vp.lastResult : null;

  return (
    <div className="vp-bezel relative mx-auto flex h-full w-full max-w-5xl flex-col gap-2 rounded-[1.75rem] p-2 sm:p-3">
      {/* LCD screen */}
      <div className="vp-screen flex min-h-0 flex-1 flex-col gap-2 rounded-2xl p-2 sm:p-3">
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

        {/* Cards fill the remaining screen height */}
        <div className="min-h-0 flex-1">
          <VideoPokerTable
            hand={vp.hand}
            held={vp.held}
            phase={vp.phase}
            handId={vp.handId}
            winningCardIndexes={vp.winningCardIndexes}
            onAnimatingChange={setUiAnimating}
            onToggleHold={(i) => guard(vp.toggleHold(i))}
          />
        </div>

        <VideoPokerResultBanner result={showResult} phase={vp.phase} />
      </div>

      {/* Physical controls below the screen */}
      <div className="shrink-0">
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
      </div>

      {toast && (
        <div className="animate-fadeIn pointer-events-none absolute inset-x-0 bottom-20 mx-auto w-fit rounded-full border border-red-500/40 bg-black/85 px-4 py-2 text-sm text-red-200">
          {toast}
        </div>
      )}
    </div>
  );
}
