import { config } from '../config';

type SoundName = keyof typeof config.assets.sounds;

export type { SoundName };

const cache = new Map<SoundName, HTMLAudioElement>();

function ensure(name: SoundName): HTMLAudioElement {
  const existing = cache.get(name);
  if (existing) return existing;
  const audio = new Audio(config.assets.sounds[name]);
  cache.set(name, audio);
  return audio;
}

export function playSound(name: SoundName): void {
  const audio = ensure(name);
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
