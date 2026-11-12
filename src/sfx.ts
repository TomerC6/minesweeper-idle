// Synthesized sound effects (Web Audio), so the build stays one file with no audio assets.

const PREF_KEY = 'minesweeper-idle.muted';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(PREF_KEY, m ? '1' : '0');
  } catch {
    // preference just won't persist
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; slideTo?: number; delay?: number } = {}) {
  const a = audio();
  if (!a || !master) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = opts.type ?? 'triangle';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const vol = opts.vol ?? 0.2;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function hiss(dur: number, cutoff: number, vol: number) {
  const a = audio();
  if (!a || !master || !noise) return;
  const src = a.createBufferSource();
  src.buffer = noise;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, a.currentTime);
  filter.frequency.exponentialRampToValueAtTime(60, a.currentTime + dur);
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start();
  src.stop(a.currentTime + dur);
}

// A major pentatonic scale: combo steps climb it, so a long combo sounds like a rising run
const PENTA = [0, 2, 4, 7, 9];
function note(step: number, base = 523.25): number {
  const octave = Math.floor(step / PENTA.length);
  return base * 2 ** ((PENTA[step % PENTA.length] + 12 * octave) / 12);
}

let lastAutoTick = 0;

export const sfx = {
  harvest(combo: number) {
    tone(note(Math.min(Math.max(combo - 1, 0), 14)), 0.09, { type: 'triangle', vol: 0.18 });
  },
  autoHarvest() {
    const now = performance.now();
    if (now - lastAutoTick < 120) return;
    lastAutoTick = now;
    tone(1046, 0.04, { type: 'sine', vol: 0.04 });
  },
  crit() {
    tone(1318.5, 0.12, { type: 'square', vol: 0.08 });
    tone(1975.5, 0.22, { type: 'triangle', vol: 0.16, delay: 0.06 });
  },
  discover(rich: boolean) {
    const steps = rich ? [0, 2, 4, 5, 7] : [0, 2, 4];
    steps.forEach((s, k) => tone(note(s, 392), 0.14, { vol: 0.14, delay: k * 0.05 }));
  },
  reveal() {
    tone(330, 0.05, { type: 'sine', vol: 0.12, slideTo: 440 });
  },
  flag() {
    tone(587, 0.06, { type: 'square', vol: 0.05 });
  },
  buy() {
    [0, 2, 4].forEach((s, k) => tone(note(s + 5), 0.1, { vol: 0.12, delay: k * 0.04 }));
  },
  milestone() {
    [0, 2, 4, 5, 7, 10].forEach((s, k) => tone(note(s), 0.18, { type: 'square', vol: 0.06, delay: k * 0.06 }));
  },
  shield() {
    tone(880, 0.3, { type: 'sine', vol: 0.18, slideTo: 1760 });
  },
  planted() {
    tone(140, 0.35, { type: 'sawtooth', vol: 0.12, slideTo: 50 });
  },
  boom() {
    hiss(0.9, 2400, 0.7);
    tone(90, 0.6, { type: 'sine', vol: 0.5, slideTo: 30 });
  },
  cashout() {
    tone(1568, 0.08, { type: 'square', vol: 0.07 });
    tone(2093, 0.25, { type: 'triangle', vol: 0.15, delay: 0.07 });
  },
  clear() {
    [0, 2, 4, 5, 7, 9, 10].forEach((s, k) => tone(note(s, 392), 0.22, { vol: 0.14, delay: k * 0.07 }));
  },
};
