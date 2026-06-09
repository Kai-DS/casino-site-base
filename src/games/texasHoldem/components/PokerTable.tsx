// games/texasHoldem/components/PokerTable.tsx
// The green felt itself (spec §23): radial-gradient emerald felt, brass rail, inner soft
// shadow, subtle texture + vignette, a slow ambient centre glow, and a mild pseudo-3D tilt.
// It is a layout shell — the seats / community / pot are positioned by the parent on top.
import type { ReactNode } from "react";

export function PokerTable({ children }: { children: ReactNode }) {
  return (
    <div className="holdem-stage w-full">
      <div className="holdem-tilt relative mx-auto aspect-[16/10] w-full max-w-4xl">
        <div className="holdem-felt absolute inset-0">
          {/* §23.1 faint central bet line */}
          <div className="holdem-bet-line absolute left-1/2 top-1/2 h-[46%] w-[62%] -translate-x-1/2 -translate-y-1/2 opacity-40" />
        </div>
        {/* Seats / community / pot live here, positioned by % (tableLayout.ts). */}
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  );
}
