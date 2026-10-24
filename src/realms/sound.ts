/**
 * Small retro sound effects, synthesised with Web Audio: no files to load. Each sound is a few short tones or
 * noise bursts with a quick attack and an exponential fade. Nothing plays until the first user gesture (browser
 * autoplay rules) or while the player has turned sounds off in Settings.
 */
export const SOUND_IDS = [
  'click',
  'pop',
  'coin',
  'hatch',
  'evolve',
  'build',
  'spin',
  'error',
  'swing',
  'hit',
  'heavy',
  'block',
  'dodge',
  'victory',
  'defeat',
] as const;
export type SoundId = (typeof SOUND_IDS)[number];

/** One voice: a tone gliding from `from` to `to` Hz, or filtered noise whose filter glides from `from` to `to`. */
export type Voice = {
  wave: OscillatorType | 'noise';
  from: number;
  to?: number;
  ms: number;
  gain?: number;
  delay?: number;
  filter?: BiquadFilterType;
};

const notes = (hz: number[], ms: number, wave: OscillatorType = 'square', gain = 0.1, gapMs = ms): Voice[] =>
  hz.map((from, i) => ({ wave, from, ms, gain, delay: i * gapMs }));

export const SOUNDS: Record<SoundId, Voice[]> = {
  click: [{ wave: 'square', from: 900, to: 600, ms: 35, gain: 0.05 }],
  pop: [{ wave: 'square', from: 380, to: 900, ms: 80, gain: 0.09 }],
  coin: [
    { wave: 'square', from: 988, ms: 70, gain: 0.08 },
    { wave: 'square', from: 1319, ms: 180, gain: 0.08, delay: 70 },
  ],
  hatch: [
    { wave: 'noise', from: 2500, to: 1200, ms: 70, gain: 0.25, filter: 'bandpass' },
    ...notes([523, 659, 784, 1047], 90, 'triangle', 0.16, 80).map((v) => ({ ...v, delay: (v.delay ?? 0) + 90 })),
  ],
  evolve: [
    { wave: 'triangle', from: 260, to: 1100, ms: 450, gain: 0.14 },
    ...notes([784, 988, 1175, 1568], 90, 'square', 0.06, 90).map((v) => ({ ...v, delay: (v.delay ?? 0) + 300 })),
  ],
  build: [
    { wave: 'noise', from: 500, to: 120, ms: 110, gain: 0.35, filter: 'lowpass' },
    { wave: 'square', from: 196, to: 140, ms: 130, gain: 0.08 },
    { wave: 'noise', from: 500, to: 120, ms: 90, gain: 0.25, filter: 'lowpass', delay: 160 },
  ],
  spin: notes([1200, 1150, 1100, 1050, 1000, 950, 900], 25, 'square', 0.05, 70),
  error: [
    { wave: 'square', from: 180, to: 150, ms: 90, gain: 0.07 },
    { wave: 'square', from: 150, to: 120, ms: 110, gain: 0.07, delay: 110 },
  ],
  swing: [{ wave: 'noise', from: 700, to: 3200, ms: 140, gain: 0.18, filter: 'bandpass' }],
  hit: [
    { wave: 'noise', from: 1400, to: 300, ms: 110, gain: 0.35, filter: 'lowpass' },
    { wave: 'square', from: 220, to: 60, ms: 120, gain: 0.1 },
  ],
  heavy: [
    { wave: 'noise', from: 1000, to: 80, ms: 380, gain: 0.45, filter: 'lowpass' },
    { wave: 'sawtooth', from: 160, to: 35, ms: 420, gain: 0.12 },
  ],
  block: [
    { wave: 'noise', from: 4000, ms: 45, gain: 0.2, filter: 'highpass' },
    { wave: 'triangle', from: 1480, to: 1320, ms: 220, gain: 0.12 },
    { wave: 'square', from: 2217, ms: 90, gain: 0.03 },
  ],
  dodge: [{ wave: 'noise', from: 2500, to: 600, ms: 180, gain: 0.14, filter: 'bandpass' }],
  victory: [...notes([523, 659, 784], 110, 'square', 0.08), { wave: 'square', from: 1047, ms: 380, gain: 0.09, delay: 330 }],
  defeat: [...notes([392, 330], 180, 'triangle', 0.14), { wave: 'triangle', from: 262, to: 220, ms: 480, gain: 0.14, delay: 360 }],
};

const PREF_KEY = 'dino-realms-sound';
let enabled = (() => {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
})();
export const soundEnabled = () => enabled;
export function setSoundEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* Optional preference. */
  }
}

let ctx: AudioContext | null = null,
  master: GainNode | null = null,
  noise: AudioBuffer | null = null;
function audio() {
  if (ctx) return ctx;
  const Ctx = typeof window === 'undefined' ? undefined : window.AudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

export function playSound(id: SoundId) {
  if (!enabled) return;
  try {
    const ac = audio();
    if (!ac || !master || !noise) return;
    if (ac.state === 'suspended') void ac.resume();
    for (const v of SOUNDS[id]) {
      const start = ac.currentTime + (v.delay ?? 0) / 1000,
        end = start + v.ms / 1000;
      const env = ac.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(v.gain ?? 0.1, start + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      env.connect(master);
      let source: AudioScheduledSourceNode;
      if (v.wave === 'noise') {
        const n = ac.createBufferSource(),
          filter = ac.createBiquadFilter();
        n.buffer = noise;
        filter.type = v.filter ?? 'lowpass';
        filter.frequency.setValueAtTime(v.from, start);
        if (v.to) filter.frequency.exponentialRampToValueAtTime(v.to, end);
        n.connect(filter).connect(env);
        source = n;
      } else {
        const osc = ac.createOscillator();
        osc.type = v.wave;
        osc.frequency.setValueAtTime(v.from, start);
        if (v.to) osc.frequency.exponentialRampToValueAtTime(v.to, end);
        osc.connect(env);
        source = osc;
      }
      source.start(start);
      source.stop(end + 0.02);
    }
  } catch {
    /* Sound is decoration: a failing audio device never interrupts play. */
  }
}
