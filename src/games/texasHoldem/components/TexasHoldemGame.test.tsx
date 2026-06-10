// @vitest-environment jsdom
// End-to-end smoke test: drive a whole hand through the real UI + real useTexasHoldem hook,
// with the animation queue playing. Proves the wiring is live — the hand only reaches a
// result if onAnimationEventComplete fires for every queued event (spec §26.2 / §35.25).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Rate } from "@/types/casino";
import type { GameEconomy, GameResultDraft } from "@/games/shared/economy";
import { TexasHoldemGame } from "./TexasHoldemGame";
import { findHoldemSandboxScenario } from "@/sandbox/texasHoldem/scenarios";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LOW: Rate = { id: "low", label: "LOW", buyInMin: 100, buyInMax: 500, betMin: 1, betMax: 5, blurb: "test" };

function mockEconomy(initial: number): GameEconomy & { log: GameResultDraft[] } {
  let chips = initial;
  const log: GameResultDraft[] = [];
  return {
    get chips() {
      return chips;
    },
    placeBet(amount) {
      if (chips < amount) return false;
      chips -= amount;
      return true;
    },
    settle(draft) {
      chips += draft.payout;
      log.push(draft);
    },
    log,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function buttonByText(label: string): HTMLButtonElement | null {
  const buttons = Array.from(container.querySelectorAll("button"));
  return (
    (buttons.find((b) => b.textContent?.toUpperCase().includes(label.toUpperCase()) && !b.disabled) as HTMLButtonElement) ??
    null
  );
}

function click(btn: HTMLButtonElement | null) {
  if (!btn) return;
  act(() => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

// Advance past the longest single event (DURATION.dramatic = 1000ms). Each act boundary lets
// the queue's completion timer fire and the hook schedule the next one, so one call ≈ one event.
function flush() {
  act(() => {
    vi.advanceTimersByTime(1100);
  });
}

describe("TexasHoldemGame end-to-end", () => {
  it("plays a full hand through the event queue to a result", () => {
    const economy = mockEconomy(1000);
    const deck = findHoldemSandboxScenario("showdown-player-win").deck;

    act(() => {
      root.render(<TexasHoldemGame rate={LOW} economy={economy} animationEnabled rng={() => 0} deckProvider={() => deck} />);
    });

    // Buy in, then deal.
    click(buttonByText("Sit down"));
    flush();
    click(buttonByText("Deal hand"));

    // Play out the hand: keep flushing the queue and taking the cheapest legal action when
    // it is our turn, until a result banner appears.
    let reachedResult = false;
    for (let i = 0; i < 300; i++) {
      flush();
      if (container.textContent?.match(/YOU WIN|YOU LOSE|SPLIT POT/)) {
        reachedResult = true;
        break;
      }
      // Our turn? take the no-cost action (check), else call. (no-op when nothing is enabled)
      click(buttonByText("Check") ?? buttonByText("Call"));
    }

    expect(reachedResult).toBe(true);
    // The human settled at least one play (won or lost) — economy was driven through the UI.
    expect(economy.log.length).toBeGreaterThan(0);
    // Heavier fake-timer loop (longer community reveals + per-card timers) → allow more wall time.
  }, 20000);
});
