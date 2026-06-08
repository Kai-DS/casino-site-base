// games/videoPoker/sound.ts — tiny Web Audio synth (no assets). Lazy AudioContext created on
// first user gesture; everything guarded so audio can never break gameplay. Mute is in-memory.
type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let muted = false;
const listeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, dur: number, when = 0, type: Wave = "triangle", gain = 0.06, slideTo?: number): void {
  const c = audio();
  if (!c) return;
  try {
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  } catch {
    /* ignore */
  }
}

function arpeggio(freqs: number[], step = 0.09, dur = 0.16, gain = 0.06): void {
  freqs.forEach((f, i) => blip(f, dur, i * step, "triangle", gain));
}

export const sound = {
  deal: () => !muted && blip(560, 0.06, 0, "square", 0.035),
  hold: () => !muted && blip(320, 0.05, 0, "square", 0.05),
  draw: () => !muted && blip(440, 0.09, 0, "sawtooth", 0.04, 680),
  win: () => !muted && arpeggio([660, 880], 0.08, 0.14, 0.05),
  bigWin: () => !muted && arpeggio([523, 659, 784, 1047], 0.08, 0.16, 0.06),
  royal: () => !muted && arpeggio([523, 659, 784, 1047, 1319, 1568], 0.1, 0.22, 0.07),

  isMuted: () => muted,
  toggleMute: () => {
    muted = !muted;
    listeners.forEach((fn) => fn());
    return muted;
  },
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
