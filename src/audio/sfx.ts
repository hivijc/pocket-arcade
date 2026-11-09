import { puttPitch, puttVolume, rollVolume, type Sound } from './sfx-math';

/** Sound effects only: there is deliberately no background music or ambience. */
export interface Sfx {
  /** Call from a user gesture: browsers only allow audio to start after one. */
  unlock(): void;
  putt(power: number): void;
  play(sound: Sound): void;
  setRoll(speed: number): void;
  /** Freeze all sound (paused game, hidden tab). */
  suspend(): void;
  resume(): void;
}

const SILENT: Sfx = { unlock() {}, putt() {}, play() {}, setRoll() {}, suspend() {}, resume() {} };

/** The live audio graph, built once on unlock. */
interface Graph {
  readonly ac: AudioContext;
  readonly master: GainNode;
  readonly noise: AudioBuffer;
  readonly rollGain: GainNode;
}

/** Suspend or resume a context; failures (sync or async) only cost us the pause, so just log them. */
function setRunning(ac: AudioContext, running: boolean): void {
  const warn = (err: unknown) => console.warn(`Audio ${running ? 'resume' : 'suspend'} failed:`, err);
  try {
    (running ? ac.resume() : ac.suspend()).catch(warn);
  } catch (err) {
    warn(err);
  }
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  return noise;
}

/** A looping low-passed noise source whose gain the rolling ball drives. */
function rollLoop(ac: AudioContext, noise: AudioBuffer, master: GainNode): GainNode {
  const roll = ac.createBufferSource();
  const lp = ac.createBiquadFilter();
  const rollGain = ac.createGain();
  roll.buffer = noise;
  roll.loop = true;
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  rollGain.gain.value = 0;
  roll.connect(lp).connect(rollGain).connect(master);
  roll.start();
  return rollGain;
}

function buildGraph(AC: typeof AudioContext): Graph {
  const ac = new AC();
  const master = ac.createGain();
  master.gain.value = 0.8;
  master.connect(ac.destination);
  const noise = noiseBuffer(ac);
  return { ac, master, noise, rollGain: rollLoop(ac, noise, master) };
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(gr: Graph, type: OscillatorType, freq: number, peak: number, decay: number, at = 0, freqEnd?: number): void {
  const t = gr.ac.currentTime + at;
  const o = gr.ac.createOscillator();
  const g = gr.ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
  env(g, t, peak, 0.005, decay);
  o.connect(g).connect(gr.master);
  o.start(t);
  o.stop(t + decay + 0.05);
}

function burst(gr: Graph, filter: BiquadFilterType, freq: number, peak: number, decay: number, freqEnd?: number): void {
  const t = gr.ac.currentTime;
  const src = gr.ac.createBufferSource();
  const f = gr.ac.createBiquadFilter();
  const g = gr.ac.createGain();
  src.buffer = gr.noise;
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
  env(g, t, peak, 0.005, decay);
  src.connect(f).connect(g).connect(gr.master);
  src.start(t);
  src.stop(t + decay + 0.05);
}

function puttSound(gr: Graph, power: number): void {
  burst(gr, 'bandpass', 1800 * puttPitch(power), puttVolume(power), 0.05);
  tone(gr, 'sine', 900 * puttPitch(power), puttVolume(power) * 0.5, 0.04);
}

function playSound(gr: Graph, sound: Sound): void {
  if (sound === 'plink') {
    tone(gr, 'sine', 1568, 0.25, 0.4);
    tone(gr, 'sine', 2349, 0.15, 0.35, 0.03);
  } else if (sound === 'splash') {
    burst(gr, 'lowpass', 2000, 0.35, 0.5, 300);
  } else if (sound === 'wall') {
    tone(gr, 'square', 300, 0.06, 0.025);
  } else {
    tone(gr, 'sine', 140, 0.15, 0.06);
  }
}

export function createSfx(): Sfx {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return SILENT;
  let graph: Graph | null = null;
  let rollLevel = 0;

  return {
    unlock() {
      if (graph) return;
      try {
        graph = buildGraph(AC);
      } catch (err) {
        console.warn('Audio unavailable:', err);
        graph = null;
      }
    },
    putt(power) {
      if (graph) puttSound(graph, power);
    },
    play(sound) {
      if (graph) playSound(graph, sound);
    },
    setRoll(speed) {
      const level = rollVolume(speed);
      if (!graph || level === rollLevel) return;
      rollLevel = level;
      graph.rollGain.gain.setTargetAtTime(level, graph.ac.currentTime, 0.05);
    },
    suspend() {
      if (graph) setRunning(graph.ac, false);
    },
    resume() {
      if (graph) setRunning(graph.ac, true);
    },
  };
}
