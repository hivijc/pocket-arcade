import type { Cue, Sound, Swish } from './sfx-math';

/** Sound effects only: there is deliberately no background music or ambience. */
export interface Sfx {
  /** Call from a user gesture: browsers only allow audio to start after one. Returns true once the context is running. */
  unlock(): boolean;
  play(cue: Cue): void;
  /** The continuous carve swish, updated every frame. */
  swish(s: Swish): void;
  setMuted(muted: boolean): void;
}

interface Graph {
  readonly ac: AudioContext;
  readonly master: GainNode;
  readonly noise: AudioBuffer;
  readonly swishGain: GainNode;
  readonly swishFilter: BiquadFilterNode;
}

const SILENT: Sfx = { unlock: () => true, play() {}, swish() {}, setMuted() {} };
const VOLUME = 0.7;

function noiseBuffer(ac: AudioContext): AudioBuffer {
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const ch = buf.getChannelData(0);
  // In-place fill of a fresh audio buffer: allowed per-frame-buffer mutation.
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  return buf;
}

function envelope(g: Graph, t: number, vol: number, dur: number): GainNode {
  const env = g.ac.createGain();
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  env.connect(g.master);
  return env;
}

function tone(g: Graph, freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number): void {
  const t = g.ac.currentTime + at;
  const osc = g.ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  osc.connect(envelope(g, t, vol, dur));
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function hiss(g: Graph, dur: number, type: BiquadFilterType, freq: number, vol: number, at = 0): void {
  const t = g.ac.currentTime + at;
  const src = g.ac.createBufferSource();
  const filter = g.ac.createBiquadFilter();
  src.buffer = g.noise;
  filter.type = type;
  filter.frequency.value = freq;
  src.connect(filter).connect(envelope(g, t, vol, dur));
  src.start(t);
  src.stop(t + dur + 0.02);
}

const RECIPES: Readonly<Record<Sound, (g: Graph, pitch?: number) => void>> = {
  beep: (g) => tone(g, 660, 0.12, 'square', 0.12),
  go: (g) => tone(g, 990, 0.25, 'square', 0.14),
  pop: (g) => { tone(g, 320, 0.08, 'triangle', 0.25, 0, 640); hiss(g, 0.05, 'highpass', 2500, 0.1); },
  thud: (g) => { tone(g, 110, 0.14, 'sine', 0.35, 0, 60); hiss(g, 0.1, 'lowpass', 700, 0.25); },
  sparkle: (g) => [1320, 1760, 2640].forEach((f, i) => tone(g, f, 0.12, 'sine', 0.1, 0.04 + i * 0.05)),
  crunch: (g) => { hiss(g, 0.35, 'lowpass', 900, 0.55); tone(g, 90, 0.3, 'sawtooth', 0.15, 0, 45); },
  chime: (g, pitch = 660) => { tone(g, pitch, 0.4, 'sine', 0.22); tone(g, pitch * 1.5, 0.3, 'sine', 0.08, 0.02); },
  tick: (g) => tone(g, 2400, 0.05, 'square', 0.06),
  sting: (g) => [523, 659, 1047].forEach((f, i) => tone(g, f, 0.3, 'triangle', 0.2, i * 0.11)),
};

function resumeIfSuspended(g: Graph): boolean {
  if (g.ac.state === 'running') return true;
  if (g.ac.state === 'suspended') void g.ac.resume().catch(() => undefined);
  return false;
}

/** A looping noise source through a band-pass and a gain the frame loop rides. */
function startSwish(ac: AudioContext, master: GainNode, noise: AudioBuffer): Pick<Graph, 'swishGain' | 'swishFilter'> {
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const swishFilter = ac.createBiquadFilter();
  swishFilter.type = 'bandpass';
  swishFilter.Q.value = 0.8;
  const swishGain = ac.createGain();
  swishGain.gain.value = 0;
  src.connect(swishFilter).connect(swishGain).connect(master);
  src.start();
  return { swishGain, swishFilter };
}

export function createSfx(): Sfx {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return SILENT;
  let graph: Graph | null = null; // created on the first gesture
  let muted = false;
  return {
    unlock() {
      if (graph) return resumeIfSuspended(graph);
      try {
        const ac = new AC();
        const master = ac.createGain();
        master.gain.value = muted ? 0 : VOLUME;
        master.connect(ac.destination);
        const noise = noiseBuffer(ac);
        graph = { ac, master, noise, ...startSwish(ac, master, noise) };
      } catch (err) {
        console.warn('Audio is unavailable:', err);
        return true; // nothing to retry
      }
      return resumeIfSuspended(graph);
    },
    play(cue) {
      if (!graph || muted) return;
      resumeIfSuspended(graph);
      try {
        RECIPES[cue.sound](graph, cue.pitch);
      } catch (err) {
        console.warn(`Sound "${cue.sound}" failed:`, err);
      }
    },
    swish(s) {
      if (!graph) return;
      const t = graph.ac.currentTime;
      graph.swishGain.gain.setTargetAtTime(s.level, t, 0.05);
      graph.swishFilter.frequency.setTargetAtTime(s.cutoff, t, 0.05);
    },
    setMuted(m) {
      muted = m;
      if (graph) graph.master.gain.setTargetAtTime(m ? 0 : VOLUME, graph.ac.currentTime, 0.02);
    },
  };
}
