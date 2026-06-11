// sandbox/roulette/RouletteSandbox.tsx — isolated dev harness for Roulette (base spec §8.1 +
// addendum §13). Drives the REAL useRoulette logic with a mock economy; exposes animationMode
// (standard/full/reduced), a forced prefers-reduced-motion toggle, forced outcomes (0/17/red/black),
// the live visualFocus / resultRevealed / active event / durationFor, and the availableActions /
// cappedPositionIds / stagedTotal / settlement inspector.
import { useCallback, useMemo, useRef, useState } from "react";
import { useMockEconomy } from "@/sandbox/useMockEconomy";
import { RATE_BY_ID } from "@/constants/rates";
import { colorOf } from "@/games/roulette/constants/wheel";
import { RouletteGame, type RouletteInspect } from "@/components/roulette/RouletteGame";
import { type RouletteAnimationMode, loadAnimationMode, saveAnimationMode } from "@/components/roulette/animationMode";

const MODES: RouletteAnimationMode[] = ["standard", "full", "reduced"];
const SAMPLE_RED = 32; // a red pocket
const SAMPLE_BLACK = 26; // a black pocket

export function RouletteSandbox() {
  const economy = useMockEconomy(2000);
  // Persisted like production (same localStorage key) so reload-keeps-mode is verifiable here too.
  const [mode, setModeState] = useState<RouletteAnimationMode>(() => loadAnimationMode());
  const setMode = useCallback((m: RouletteAnimationMode) => {
    setModeState(m);
    saveAnimationMode(m);
  }, []);
  const [forceReduced, setForceReduced] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [forced, setForced] = useState<number | null>(null);
  const forcedRef = useRef<number | null>(forced);
  forcedRef.current = forced;

  const [inspect, setInspect] = useState<RouletteInspect | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const lastEventId = useRef<string | null>(null);

  // Stable provider that reads the latest forced value (null → random).
  const providers = useMemo(
    () => ({ resultProvider: () => forcedRef.current ?? Math.floor(Math.random() * 37) }),
    [],
  );

  const handleInspect = useCallback((info: RouletteInspect) => {
    setInspect(info);
    const ev = info.view.activeEvent;
    if (ev && ev.id !== lastEventId.current) {
      lastEventId.current = ev.id;
      const extra = ev.type === "BALL_LAND" ? ` →${ev.result.number}` : "";
      setLog((l) => [
        `${ev.type}${extra} · ${info.activeDurationMs}ms · focus=${info.view.visualFocus} · reveal=${info.view.resultRevealed}`,
        ...l,
      ].slice(0, 24));
    }
  }, []);

  const v = inspect?.view;

  return (
    <div className="min-h-screen bg-[#0c0710] text-white">
      <div className="border-b border-white/10 bg-black/40 px-4 py-2">
        <span className="font-display text-sm text-[var(--gold-2)]">SANDBOX</span>
        <span className="ml-2 text-xs text-white/50">Roulette — logic harness · mock economy</span>
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* the real game on the mock economy */}
        <div className="rounded-2xl border border-white/10 bg-[#140b1a]">
          <RouletteGame
            rate={RATE_BY_ID.low}
            economy={economy}
            animationEnabled={animationEnabled}
            providers={providers}
            mode={mode}
            onModeChange={setMode}
            forceReducedMotion={forceReduced}
            onInspect={handleInspect}
          />
        </div>

        {/* inspector + controls */}
        <div className="flex flex-col gap-3 text-xs">
          <Panel title="Animation mode">
            <div className="flex gap-1">
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md border px-2 py-1 font-semibold uppercase ${
                    mode === m ? "border-[var(--gold-2)] bg-[var(--gold-2)] text-[#2a1d05]" : "border-white/15 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={forceReduced} onChange={(e) => setForceReduced(e.target.checked)} />
              force prefers-reduced-motion
            </label>
            <label className="mt-1 flex items-center gap-2">
              <input type="checkbox" checked={animationEnabled} onChange={(e) => setAnimationEnabled(e.target.checked)} />
              animationEnabled
            </label>
          </Panel>

          <Panel title="Forced outcome">
            <div className="mb-2 flex flex-wrap gap-1">
              <Quick label="0" active={forced === 0} onClick={() => setForced(0)} />
              <Quick label="17" active={forced === 17} onClick={() => setForced(17)} />
              <Quick label={`red ${SAMPLE_RED}`} active={forced === SAMPLE_RED} onClick={() => setForced(SAMPLE_RED)} />
              <Quick label={`black ${SAMPLE_BLACK}`} active={forced === SAMPLE_BLACK} onClick={() => setForced(SAMPLE_BLACK)} />
              <Quick label="random" active={forced === null} onClick={() => setForced(null)} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={36}
                value={forced ?? ""}
                placeholder="0–36"
                onChange={(e) => {
                  const n = e.target.value === "" ? null : Math.max(0, Math.min(36, Number(e.target.value)));
                  setForced(Number.isNaN(n as number) ? null : n);
                }}
                className="w-20 rounded-md border border-white/15 bg-black/40 px-2 py-1 tabular-nums"
              />
              <span className="text-white/50">
                forced = {forced == null ? "random" : `${forced} (${colorOf(forced)})`}
              </span>
            </div>
          </Panel>

          <Panel title="Live state">
            <Row k="phase" val={inspect?.phase ?? "—"} />
            <Row k="visualFocus" val={v?.visualFocus ?? "—"} />
            <Row k="resultRevealed" val={String(v?.resultRevealed ?? false)} highlight={v?.resultRevealed === false && v?.activeEvent != null} />
            <Row k="activeEvent" val={v?.activeEvent ? v.activeEvent.type : "—"} />
            <Row k="durationFor" val={inspect ? `${inspect.activeDurationMs}ms` : "—"} />
            <Row k="reducedMotion" val={String(inspect?.effectiveReducedMotion ?? false)} />
            <Row k="landedNumber" val={v?.landedNumber == null ? "—" : String(v.landedNumber)} />
            <Row k="stagedTotal" val={String(inspect?.stagedTotal ?? 0)} />
            <Row k="cappedPositionIds" val={String(inspect?.cappedCount ?? 0)} />
            <Row k="chips (mock)" val={String(economy.chips)} />
          </Panel>

          <Panel title="availableActions">
            <pre className="overflow-x-auto whitespace-pre-wrap text-[10px] text-white/70">
              {inspect ? formatActions(inspect.availableActions) : "—"}
            </pre>
          </Panel>

          <Panel title="settlement (raw)">
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[10px] text-white/60">
              {inspect?.settlement
                ? JSON.stringify(
                    {
                      number: inspect.settlement.result.number,
                      color: inspect.settlement.result.color,
                      totalBet: inspect.settlement.totalBet,
                      totalReturned: inspect.settlement.totalReturned,
                      profit: inspect.settlement.profit,
                      winners: inspect.settlement.winningBetIds.length,
                      losers: inspect.settlement.losingBetIds.length,
                    },
                    null,
                    1,
                  )
                : "—"}
            </pre>
          </Panel>

          <Panel title="Event log">
            <div className="max-h-48 space-y-0.5 overflow-auto font-mono text-[10px] text-white/60">
              {log.length === 0 && <div className="text-white/30">— (place bets, then Spin)</div>}
              {log.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-2">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold-2)]">{title}</div>
      {children}
    </div>
  );
}

function Row({ k, val, highlight }: { k: string; val: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-white/45">{k}</span>
      <span className={`tabular-nums ${highlight ? "font-bold text-amber-300" : "text-white/85"}`}>{val}</span>
    </div>
  );
}

function Quick({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-1 ${active ? "border-[var(--gold-2)] bg-[var(--gold-2)] text-[#2a1d05]" : "border-white/15 text-white/70 hover:bg-white/10"}`}
    >
      {label}
    </button>
  );
}

function formatActions(a: RouletteInspect["availableActions"]): string {
  return (Object.keys(a) as Array<keyof typeof a>)
    .map((k) => {
      const av = a[k];
      const amt = av.amount != null ? ` amount=${av.amount}` : "";
      return `${k}: ${av.enabled ? "✓" : `✗ ${av.reason ?? ""}`}${amt}`;
    })
    .join("\n");
}
