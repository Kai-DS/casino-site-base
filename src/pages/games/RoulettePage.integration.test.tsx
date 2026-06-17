// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAMES, getGame } from "@/constants/games";
import { RATE_BY_ID, RATES } from "@/constants/rates";
import { STARTING_CHIPS } from "@/repositories/userRepository";
import { __resetCasinoStoreForTest, useCasinoStore } from "@/store/casinoStore";
import { LobbyPage } from "@/pages/LobbyPage";
import { RoulettePage } from "./RoulettePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function installLocalStorageMock() {
  const map = new Map<string, string>();
  const mock: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
  };
  vi.stubGlobal("localStorage", mock);
}

function installMatchMediaMock() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  installLocalStorageMock();
  installMatchMediaMock();
  __resetCasinoStoreForTest();
  useCasinoStore.getState().login("Tester");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

type TestRouter = ReturnType<typeof createMemoryRouter>;

function makeRouter(initialPath = "/lobby"): TestRouter {
  return createMemoryRouter(
    [
      { path: "/lobby", element: <LobbyPage /> },
      { path: "/games/roulette", element: <RoulettePage /> },
    ],
    { initialEntries: [initialPath] },
  );
}

function renderRouter(router: TestRouter) {
  act(() => {
    root.render(<RouterProvider router={router} />);
  });
}

function allButtons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button"));
}

function buttonByLabel(label: string): HTMLButtonElement | null {
  return allButtons().find((button) => button.getAttribute("aria-label") === label) ?? null;
}

function buttonByText(text: string): HTMLButtonElement | null {
  return allButtons().find((button) => button.textContent?.includes(text)) ?? null;
}

function click(button: HTMLButtonElement | null) {
  if (!button) throw new Error("Expected button to exist");
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("Roulette production route integration", () => {
  it("keeps roulette available in the lobby and carries rate/buy-in into the game route", () => {
    expect(getGame("roulette").status).toBe("available");

    const router = makeRouter();
    renderRouter(router);

    const rouletteCard = buttonByLabel("Roulette");
    expect(rouletteCard).not.toBeNull();
    expect(rouletteCard!.disabled).toBe(false);

    click(rouletteCard);
    expect(container.textContent).toContain("Roulette — Select Rate");
    for (const rate of RATES) {
      expect(buttonByText(rate.label)).not.toBeNull();
    }

    click(buttonByText("LOW"));
    click(buttonByText("Max"));
    click(buttonByText("Sit"));

    expect(router.state.location.pathname).toBe("/games/roulette");
    expect(useCasinoStore.getState().currentRate?.id).toBe("low");
    expect(useCasinoStore.getState().tableStack).toBe(RATE_BY_ID.low.buyInMax);
    expect(useCasinoStore.getState().user!.chips).toBe(STARTING_CHIPS);
    expect(container.textContent).toContain("ROULETTE");
    expect(container.textContent).toContain("LOW");
  });

  it("redirects direct roulette entry without a current rate back to the lobby", () => {
    const router = makeRouter("/games/roulette");
    renderRouter(router);

    expect(router.state.location.pathname).toBe("/lobby");
    expect(useCasinoStore.getState().currentRate).toBeNull();
    expect(useCasinoStore.getState().tableStack).toBeNull();
  });

  it("closes the roulette table session once on exit", () => {
    expect(useCasinoStore.getState().buyIn(RATE_BY_ID.low, RATE_BY_ID.low.buyInMax)).toBe(true);
    const router = makeRouter("/games/roulette");
    renderRouter(router);

    expect(router.state.location.pathname).toBe("/games/roulette");
    expect(useCasinoStore.getState().tableStack).toBe(RATE_BY_ID.low.buyInMax);

    click(buttonByText("Exit"));

    expect(router.state.location.pathname).toBe("/lobby");
    expect(useCasinoStore.getState().currentRate).toBeNull();
    expect(useCasinoStore.getState().tableStack).toBeNull();
    expect(useCasinoStore.getState().user!.chips).toBe(STARTING_CHIPS);
  });

  it("only exposes the production roulette path from the lobby game registry", () => {
    const roulette = GAMES.find((game) => game.id === "roulette");
    expect(roulette?.path).toBe("/games/roulette");
  });
});
