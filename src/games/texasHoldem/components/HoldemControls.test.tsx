// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AvailableActions } from "../types";
import { HoldemControls } from "./HoldemControls";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// While an animation is playing the hook returns this: every action disabled with "ANIMATING".
const ALL_ANIMATING: AvailableActions = {
  fold: { enabled: false, reason: "ANIMATING" },
  check: { enabled: false, reason: "ANIMATING" },
  call: { enabled: false, reason: "ANIMATING" },
  bet: { enabled: false, reason: "ANIMATING" },
  raise: { enabled: false, reason: "ANIMATING" },
  allIn: { enabled: false, reason: "ANIMATING" },
};

// A normal preflop turn: the player can fold / call / raise / all-in but not check / bet.
const PLAYER_TURN: AvailableActions = {
  fold: { enabled: true },
  check: { enabled: false, reason: "INVALID_BET" },
  call: { enabled: true },
  bet: { enabled: false, reason: "INVALID_PHASE" },
  raise: { enabled: true },
  allIn: { enabled: true },
};

const noop = () => {};

function renderControls(available: AvailableActions) {
  act(() => {
    root.render(
      <HoldemControls
        availableActions={available}
        amountToCall={2}
        currentBet={2}
        minRaise={2}
        maxRaiseTo={100}
        bigBlind={2}
        pot={3}
        allInAmount={100}
        streetContribution={0}
        onFold={noop}
        onCheck={noop}
        onCall={noop}
        onBet={noop}
        onRaiseTo={noop}
        onAllIn={noop}
      />,
    );
  });
}

function buttonByText(label: string): HTMLButtonElement | null {
  const buttons = Array.from(container.querySelectorAll("button"));
  return (buttons.find((b) => b.textContent?.toUpperCase().includes(label.toUpperCase())) as HTMLButtonElement) ?? null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("HoldemControls UI lock", () => {
  it("disables every action while an animation is playing (spec §26.2 / §29 lock)", () => {
    renderControls(ALL_ANIMATING);
    for (const label of ["Fold", "Check", "Call", "Bet", "Raise", "3-Bet", "All-in"]) {
      expect(buttonByText(label)?.disabled, label).toBe(true);
    }
  });

  it("mirrors availableActions exactly — enabled when legal, disabled (with reason) otherwise", () => {
    renderControls(PLAYER_TURN);
    expect(buttonByText("Fold")?.disabled).toBe(false);
    expect(buttonByText("Call")?.disabled).toBe(false);
    expect(buttonByText("Raise")?.disabled).toBe(false);
    expect(buttonByText("All-in")?.disabled).toBe(false);
    // 3-Bet is a preset over raiseTo — enabled exactly when raise is.
    expect(buttonByText("3-Bet")?.disabled).toBe(false);

    const check = buttonByText("Check");
    expect(check?.disabled).toBe(true);
    expect(check?.getAttribute("title")).toBeTruthy(); // reason tooltip present
  });
});
