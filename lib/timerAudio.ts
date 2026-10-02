/**
 * Countdown music for the clue timer.
 *
 * - If the game has an uploaded track (`Game.timerMusic`), that file is played (looped).
 * - Otherwise an ORIGINAL built-in "thinking" loop is synthesised with Web Audio
 *   (soft pad + plucked arpeggio + clock tick). It is not the Jeopardy! theme —
 *   to use that, upload your own licensed copy in the game editor.
 */

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let el: HTMLAudioElement | null = null;
let elUrl: string | null = null;
let schedTimer: ReturnType<typeof setInterval> | null = null;
let nextBeat = 0;
let beat = 0;
let running = false;
let muted = readMuted();

const BPM = 112;
const BEAT = 60 / BPM; // seconds per beat (8th-note feel below)

// A minor-ish space progression — Am, F, C, G (4 beats each), original pattern
const CHORDS: number[][] = [
  [57, 60, 64], // A3 C4 E4
  [53, 57, 60], // F3 A3 C4
  [55, 60, 64], // C4 voiced over G3
  [55, 59, 62], // G3 B3 D4
];
const ARP = [0, 1, 2, 1, 2, 1, 0, 2]; // index into chord, 8 steps per chord

function readMuted(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem("astro_timer_muted") === "1";
  } catch {
    return false;
  }
}

function hz(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function ensureCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function pluck(c: Ctx, t: number, freq: number, vol: number, dur: number, type: OscillatorType = "triangle") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function pad(c: Ctx, t: number, notes: number[], dur: number) {
  for (const n of notes) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(hz(n - 12), t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

function tick(c: Ctx, t: number, accent: boolean) {
  const len = 0.03;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  const hp = c.createBiquadFilter();
  const g = c.createGain();
  hp.type = "highpass";
  hp.frequency.value = accent ? 3000 : 5000;
  g.gain.value = accent ? 0.22 : 0.1;
  src.buffer = buf;
  src.connect(hp).connect(g).connect(master!);
  src.start(t);
}

/** look-ahead scheduler for the synth loop */
function schedule() {
  const c = ctx;
  if (!c || !running) return;
  const step = BEAT / 2; // 8th notes
  while (nextBeat < c.currentTime + 0.2) {
    const chordIdx = Math.floor(beat / 8) % CHORDS.length;
    const chord = CHORDS[chordIdx];
    const pos = beat % 8;
    if (pos === 0) pad(c, nextBeat, chord, step * 8);
    pluck(c, nextBeat, hz(chord[ARP[pos]] + 12), pos % 2 ? 0.07 : 0.11, 0.35);
    if (pos === 0) pluck(c, nextBeat, hz(chord[0] - 12), 0.12, 0.6, "sine");
    if (pos % 2 === 0) tick(c, nextBeat, pos === 0);
    nextBeat += step;
    beat++;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem("astro_timer_muted", v ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (master) master.gain.value = v ? 0 : 0.5;
  if (el) el.muted = v;
}

/** Start (or resume) the countdown music. Must be called from a click. */
export function startMusic(url?: string | null) {
  stopMusic(false);
  running = true;
  if (url) {
    if (!el || elUrl !== url) {
      el?.pause();
      el = new Audio(url);
      el.loop = true;
      elUrl = url;
    }
    el.muted = muted;
    void el.play().catch(() => {});
    return;
  }
  const c = ensureCtx();
  if (!c) return;
  nextBeat = c.currentTime + 0.05;
  schedTimer = setInterval(schedule, 50);
  schedule();
}

/** Pause keeps the uploaded track's position; synth just stops. */
export function pauseMusic() {
  running = false;
  if (schedTimer) clearInterval(schedTimer);
  schedTimer = null;
  el?.pause();
}

export function resumeMusic(url?: string | null) {
  if (url && el && elUrl === url) {
    running = true;
    el.muted = muted;
    void el.play().catch(() => {});
    return;
  }
  startMusic(url);
}

/** Stop and rewind. */
export function stopMusic(rewind = true) {
  running = false;
  if (schedTimer) clearInterval(schedTimer);
  schedTimer = null;
  if (el) {
    el.pause();
    if (rewind) el.currentTime = 0;
  }
}

/** Short "time's up" buzzer. */
export function timesUp() {
  stopMusic();
  const c = ensureCtx();
  if (!c || muted) return;
  const t = c.currentTime + 0.02;
  for (const [f, d] of [[220, 0], [196, 0.18], [174.6, 0.36]] as const) {
    pluck(c, t + d, f, 0.25, 0.5, "square");
  }
}

/* ═══════════ Sound effects (synthesised, original) ═══════════ */

function tone(c: Ctx, t: number, freq: number, dur: number, vol: number, type: OscillatorType = "sine", slideTo?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(c: Ctx, t: number, dur: number, vol: number, from: number, to: number) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  const bp = c.createBiquadFilter();
  const g = c.createGain();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.buffer = buf;
  src.connect(bp).connect(g).connect(master!);
  src.start(t);
}

function play(fn: (c: Ctx, t: number) => void) {
  const c = ensureCtx();
  if (!c || muted) return;
  fn(c, c.currentTime + 0.01);
}

export const sfx = {
  /** tile opens → soft whoosh + sparkle */
  open: () =>
    play((c, t) => {
      noise(c, t, 0.45, 0.18, 400, 3200);
      [1318.5, 1760, 2093].forEach((f, i) => tone(c, t + 0.18 + i * 0.05, f, 0.35, 0.05, "sine"));
    }),
  /** a team is selected to answer */
  buzz: () => play((c, t) => tone(c, t, 880, 0.18, 0.12, "triangle", 1320)),
  /** correct → bright rising arpeggio */
  correct: () =>
    play((c, t) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, t + i * 0.08, f, 0.42, 0.16, "triangle"));
      tone(c, t + 0.32, 1567.98, 0.6, 0.06, "sine");
    }),
  /** wrong → low descending buzz */
  wrong: () =>
    play((c, t) => {
      tone(c, t, 196, 0.32, 0.16, "sawtooth", 130);
      tone(c, t + 0.02, 98, 0.36, 0.12, "square", 70);
    }),
  /** answer revealed → shimmer */
  reveal: () =>
    play((c, t) => {
      noise(c, t, 0.6, 0.08, 2000, 6000);
      [783.99, 987.77, 1174.66].forEach((f, i) => tone(c, t + i * 0.06, f, 0.6, 0.06, "sine"));
    }),
  /** connect: next clue flips in */
  next: () =>
    play((c, t) => {
      noise(c, t, 0.18, 0.12, 1200, 400);
      tone(c, t + 0.05, 660, 0.15, 0.1, "triangle", 990);
    }),
  /** final results fanfare */
  fanfare: () =>
    play((c, t) => {
      const seq: [number, number, number][] = [
        [392, 0, 0.18], [523.25, 0.18, 0.18], [659.25, 0.36, 0.18], [783.99, 0.54, 0.5],
        [659.25, 0.95, 0.15], [783.99, 1.1, 0.9],
      ];
      seq.forEach(([f, d, len]) => {
        tone(c, t + d, f, len + 0.1, 0.14, "triangle");
        tone(c, t + d, f / 2, len + 0.1, 0.07, "sine");
      });
      noise(c, t + 1.1, 1.2, 0.05, 3000, 8000);
    }),
};
