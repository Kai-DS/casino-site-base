import { formatChips } from "@/utils/format";

type ChipStackProps = {
  amount: number;
  /** Hide the numeric caption (e.g. when a parent already shows the amount). */
  showAmount?: boolean;
  size?: "sm" | "md";
  className?: string;
};

type Denom = { value: number; ring: string; face: string };

// Casino denominations, high → low. The breakdown is purely visual (spec §24.4: "show a chip
// stack, not just a number") — it never decides anything about the game.
const DENOMS: Denom[] = [
  { value: 1000, ring: "#f4d680", face: "#7a5cff" },
  { value: 500, ring: "#f1f1f1", face: "#5b21b6" },
  { value: 100, ring: "#1f2937", face: "#111827" },
  { value: 25, ring: "#10b981", face: "#065f46" },
  { value: 5, ring: "#ef4444", face: "#991b1b" },
  { value: 1, ring: "#e5e7eb", face: "#9ca3af" },
];

const MAX_CHIPS = 5;

/** Break an amount into up to MAX_CHIPS representative chips, biggest first. */
function chipsFor(amount: number): Denom[] {
  const chips: Denom[] = [];
  let remaining = Math.max(0, Math.trunc(amount));
  for (const denom of DENOMS) {
    while (remaining >= denom.value && chips.length < MAX_CHIPS) {
      chips.push(denom);
      remaining -= denom.value;
    }
    if (chips.length >= MAX_CHIPS) break;
  }
  if (chips.length === 0 && amount > 0) chips.push(DENOMS[DENOMS.length - 1]!);
  return chips;
}

/** A small denomination-coloured chip stack used in the pot and at seats (spec §24.4). */
export function ChipStack({ amount, showAmount = true, size = "md", className = "" }: ChipStackProps) {
  const chips = chipsFor(amount);
  const dim = size === "sm" ? 16 : 22;
  const overlap = size === "sm" ? 4 : 6;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {chips.length > 0 && (
        <span
          className="relative inline-block"
          style={{ width: dim, height: dim + (chips.length - 1) * overlap }}
          aria-hidden
        >
          {chips.map((chip, i) => (
            <span
              key={i}
              className="absolute left-0 rounded-full border-2"
              style={{
                width: dim,
                height: dim,
                bottom: i * overlap,
                borderColor: chip.ring,
                background: `radial-gradient(circle at 50% 35%, ${chip.face} 0%, #000 140%)`,
                boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            />
          ))}
        </span>
      )}
      {showAmount && (
        <span className="font-semibold tabular-nums text-[var(--text-hi)]" style={{ fontSize: size === "sm" ? 11 : 13 }}>
          {formatChips(amount)}
        </span>
      )}
    </div>
  );
}
