import { puttPitch, puttVolume, rollVolume, type Ambience, type Sound } from './sfx-math';

export interface Sfx {
  /** Call from a user gesture: browsers only allow audio to start after one. */
  unlock(): void;
  putt(power: number): void;
  play(sound: Sound): void;
  setRoll(speed: number): void;
  setAmbience(kind: Ambience): void;
  /** Freeze all sound (paused game, hidden tab). */
  suspend(): void;
  resume(): void;
}

const SILENT: Sfx = { unlock() {}, putt() {}, play() {}, setRoll() {}, setAmbience() {}, suspend() {}, resume() {} };

/** Suspend or resume a context; failures (sync or async) only cost us the pause, so just log them. */
function setRunning(ac: AudioContext, running: boolean): void {
  const warn = (err: unknown) => console.warn(`Audio ${running ? 'resume' : 'suspend'} failed:`, err);
  try {
    (running ? ac.resume() : ac.suspend()).catch(warn);
  } catch (err) {
    warn(err);
  }
}

export function createSfx(): Sfx {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return SILENT;
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let rollGain: GainNode | null = null;
  let rollLevel = 0;
  let ambience: Ambience | null = null;
  let ambienceTimer = 0;
  let crickets: { osc: OscillatorNode; gain: GainNode } | null = null;

  const env = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };
  const tone = (type: OscillatorType, freq: number, peak: number, decay: number, at = 0, freqEnd?: number) => {
    if (!ac || !master) return;
    const t = ac.currentTime + at;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
    env(g, t, peak, 0.005, decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + decay + 0.05);
  };
  const burst = (filter: BiquadFilterType, freq: number, peak: number, decay: number, freqEnd?: number) => {
    if (!ac || !master || !noise) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    src.buffer = noise;
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
    env(g, t, peak, 0.005, decay);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + decay + 0.05);
  };

  const chirp = () => {
    tone('sine', 3200 + Math.random() * 800, 0.03, 0.08, 0, 4200);
    tone('sine', 3400 + Math.random() * 800, 0.025, 0.07, 0.12, 4400);
  };

  const stopAmbience = () => {
    window.clearTimeout(ambienceTimer);
    crickets?.osc.stop();
    crickets = null;
  };

  const startAmbience = (kind: Ambience) => {
    stopAmbience();
    if (!ac || !master) return;
    if (kind === 'birds') {
      const next = () => {
        chirp();
        ambienceTimer = window.setTimeout(next, 1500 + Math.random() * 2500);
      };
      next();
    } else {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      osc.frequency.value = 4400;
      lfo.type = 'square';
      lfo.frequency.value = 30;
      lfoGain.gain.value = 0.012;
      gain.gain.value = 0.012;
      lfo.connect(lfoGain).connect(gain.gain);
      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
      crickets = { osc, gain };
    }
  };

  return {
    unlock() {
      if (ac) return;
      try {
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.8;
        master.connect(ac.destination);
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const ch = noise.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        const roll = ac.createBufferSource();
        const lp = ac.createBiquadFilter();
        rollGain = ac.createGain();
        roll.buffer = noise;
        roll.loop = true;
        lp.type = 'lowpass';
        lp.frequency.value = 500;
        rollGain.gain.value = 0;
        roll.connect(lp).connect(rollGain).connect(master);
        roll.start();
        if (ambience) startAmbience(ambience);
      } catch (err) {
        console.warn('Audio unavailable:', err);
        ac = null;
      }
    },
    putt(power) {
      burst('bandpass', 1800 * puttPitch(power), puttVolume(power), 0.05);
      tone('sine', 900 * puttPitch(power), puttVolume(power) * 0.5, 0.04);
    },
    play(sound) {
      if (sound === 'plink') {
        tone('sine', 1568, 0.25, 0.4);
        tone('sine', 2349, 0.15, 0.35, 0.03);
      } else if (sound === 'splash') {
        burst('lowpass', 2000, 0.35, 0.5, 300);
      } else if (sound === 'wall') {
        tone('square', 300, 0.06, 0.025);
      } else {
        tone('sine', 140, 0.15, 0.06);
      }
    },
    setRoll(speed) {
      const level = rollVolume(speed);
      if (!ac || !rollGain || level === rollLevel) return;
      rollLevel = level;
      rollGain.gain.setTargetAtTime(level, ac.currentTime, 0.05);
    },
    setAmbience(kind) {
      if (kind === ambience) return;
      ambience = kind;
      if (ac) startAmbience(kind);
    },
    suspend() {
      if (ac) setRunning(ac, false);
    },
    resume() {
      if (ac) setRunning(ac, true);
    },
  };
}
