# CASINO HUB

> Free **simulation-only** casino game hub. No real money, no gambling, no cashout — chips have no monetary value.

A browser game lobby (wine-red room, green poker felt, trump-card game selector) that you enter as a
guest and play with free chips. Built per [`casino-hub-spec-v1.0.md`](./casino-hub-spec-v1.0.md).

**Stack:** Vite · TypeScript · React 19 · React Router (`createBrowserRouter`) · Tailwind CSS · Zustand · Vitest.

## Games

| Card | Game | Status |
|------|------|--------|
| A♠ | **NEON JACK** — Juggler-style pachislot (fixed 3-medal bet) | ✅ Playable |
| J♣ | **Video Poker** — Jacks or Better (9/6) | ✅ Playable |
| K♥ | Texas Hold'em | 🔜 Coming Soon |
| Q♦ | Roulette | 🔜 Coming Soon |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest (pure logic + chip-integrity)
npm run typecheck  # tsc -b --noEmit
npm run build      # tsc -b && vite build  → dist/
npm run preview    # serve the production build
```

## Architecture (spec §5)

```
UI (pages / components)  →  store (Zustand: runtime state + actions)  →  repositories (localStorage I/O only)
```

- **Chips have one source of truth:** `UserProfile.chips`. Every change is atomic inside a `casinoStore`
  action (`placeBet` / `applyGameResult` / `claimDailyBonus` / `rescue`), and each ledger entry's
  `balanceAfter` always equals `chips` (enforced by tests).
- **Only `repositories/storage.ts` touches `localStorage`** — with `schemaVersion` + `migrate` so old
  saves survive spec revisions. Methods are `async` to ease a future Supabase swap.
- **Game logic is pure** (`games/<game>/logic/*`), UI-independent, and unit-tested. Each game's
  `adapter.ts` is the only seam to the casino economy — it converts a `Rate` to game args and produces a
  `GameResult`.
- **Rates** are two clear axes: `minBalance` (entry gate, never deducted) + `betUnit` (bet scale).

### NEON JACK note

The real NEON JACK repo wasn't available, so this codebase ships a **self-contained, Juggler-style engine**
(`games/neonjack/{logic,data}`, ~96.6% RTP) that satisfies the exact adapter interface from spec §5.5
(`buildNeonJackResult(spin, rate)` reading `betUnit` as chips-per-medal, fixed 3-medal bet). To port the
real machine later, drop its `logic/ data/ types.ts` in and keep `adapter.ts` as the only seam.

## Adding a game (spec §12.1)

1. Add `games/<id>/` (`components/ logic/ adapter.ts types.ts`).
2. Add one `GameInfo` to `constants/games.ts`.
3. Add one route to `routes/router.tsx`.
4. Implement `adapter.ts` (`Rate`→args, build `GameResult`) and call `casinoStore.applyGameResult`.

The lobby never needs editing.

## Deploy (Vercel)

Framework preset **Vite**, build `vite build`, output `dist`. `vercel.json` adds the SPA fallback for
`BrowserRouter`.
