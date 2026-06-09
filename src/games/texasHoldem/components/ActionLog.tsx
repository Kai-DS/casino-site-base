// games/texasHoldem/components/ActionLog.tsx
// A short scrolling history of what happened this hand. Pure display — the container feeds it
// formatted lines as it plays through the animation events.
import { useEffect, useRef } from "react";

export interface ActionLogEntry {
  id: string;
  text: string;
  tone?: "neutral" | "accent" | "win";
}

const TONE: Record<NonNullable<ActionLogEntry["tone"]>, string> = {
  neutral: "text-[var(--text-mid)]",
  accent: "text-[var(--neon)]",
  win: "text-[var(--gold-2)]",
};

export function ActionLog({ entries }: { entries: ActionLogEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [entries]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-black/40 p-2.5">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-dim)]">Action Log</div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-xs leading-relaxed">
        {entries.length === 0 ? (
          <div className="text-[var(--text-dim)]">—</div>
        ) : (
          <ul className="space-y-0.5">
            {entries.map((entry) => (
              <li key={entry.id} className={TONE[entry.tone ?? "neutral"]}>
                {entry.text}
              </li>
            ))}
            <div ref={endRef} />
          </ul>
        )}
      </div>
    </div>
  );
}
