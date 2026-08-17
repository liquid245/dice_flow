import { config } from '../config';

export type VibrationName = keyof typeof config.vibration.patterns;

export function vibrate(name: VibrationName): void {
  if (!config.vibration.enabled) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const pattern = config.vibration.patterns[name];
  if (pattern === 0) return;
  navigator.vibrate(pattern);
}
