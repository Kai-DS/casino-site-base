import type { ReactNode } from "react";

type PokerTableProps = {
  children: ReactNode;
  caption?: string;
};

/** The central green felt table the lobby cards are dealt onto (world view, spec §7.3 — preserved). */
export function PokerTable({ children, caption }: PokerTableProps) {
  return (
    <div className="flex w-full justify-center px-4">
      <div className="felt-table relative w-full max-w-3xl rounded-[44%/30%] px-6 py-10 sm:px-12 sm:py-14">
        {/* engraved table label */}
        <span className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 font-display text-sm uppercase tracking-[0.4em] text-gold-400/60">
          {caption ?? "Casino Hub"}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">{children}</div>
      </div>
    </div>
  );
}
