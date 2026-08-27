import { config } from '../config';

type SoundName = keyof typeof config.assets.sounds;

export type { SoundName };

let ctx: AudioContext | null = null;
const buffers = new Map<SoundName, AudioBuffer>();
const activeSources = new Set<AudioBufferSourceNode>();
let preloadStarted = false;
let unlocked = false;

function context(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

async function load(name: SoundName): Promise<AudioBuffer | null> {
  const existing = buffers.get(name);
  if (existing) return existing;
  try {
    const response = await fetch(config.assets.sounds[name]);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await context().decodeAudioData(arrayBuffer);
    if (audioBuffer) buffers.set(name, audioBuffer);
    return audioBuffer;
  } catch {
    return null;
  }
}

export function preloadSounds(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  for (const name of Object.keys(config.assets.sounds) as SoundName[]) {
    void load(name);
  }
}

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  const unlock = () => {
    const ctx = context();
    if (ctx.state === 'running') return;
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  };
  const opts: AddEventListenerOptions = { once: true, passive: true };
  window.addEventListener('pointerdown', unlock, opts);
  window.addEventListener('touchstart', unlock, opts);
  window.addEventListener('keydown', unlock, opts);
}

export function playSound(name: SoundName): void {
  const buffer = buffers.get(name);
  if (!buffer) {
    void load(name).then((b) => {
      if (b) playSound(name);
    });
    return;
  }
  const ctx = context();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  activeSources.add(source);
  source.onended = () => activeSources.delete(source);
}

export function playThump(): void {
  const t = config.vibration.thump;
  if (!t.enabled) return;
  const ctx = context();
  const now = ctx.currentTime;
  const duration = t.duration / 1000;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(t.frequency, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.frequencyEnd), now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(t.gain, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);

  if (t.click) {
    const length = Math.floor(ctx.sampleRate * 0.004);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const clickGain = ctx.createGain();
    clickGain.gain.value = t.gain * 0.6;
    source.connect(clickGain).connect(ctx.destination);
    source.start(now);
  }
}
