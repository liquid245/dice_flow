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

async function load(name: SoundName): Promise<void> {
  if (buffers.has(name)) return;
  const response = await fetch(config.assets.sounds[name]);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await context().decodeAudioData(arrayBuffer);
  buffers.set(name, audioBuffer);
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
  const resume = () => context();
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('touchstart', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
}

export function playSound(name: SoundName): void {
  const buffer = buffers.get(name);
  if (!buffer) {
    void load(name);
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
