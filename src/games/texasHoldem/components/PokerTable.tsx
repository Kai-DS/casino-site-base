// games/texasHoldem/components/PokerTable.tsx
// The poker table itself: a stadium (capsule) brass rail wrapping a green felt (spec §23,
// redesign). It fills its parent box; players are placed AROUND it by the parent — the inside of
// the felt is reserved for the community cards / pot / bet chips / bet line passed as children.
import type { ReactNode } from "react";

export function PokerTable({ children }: { children: ReactNode }) {
  return (
    <div className="holdem-tilt relative h-full w-full">
      <div className="holdem-rail absolute inset-0">
        <div className="holdem-felt absolute inset-[16px] sm:inset-[20px]">
          {/* faint inner bet line */}
          <div className="holdem-bet-line absolute left-1/2 top-[46%] h-[58%] w-[74%] -translate-x-1/2 -translate-y-1/2" />
          {/* community / pot / bet chips, positioned by % of the felt */}
          <div className="absolute inset-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
