import { config } from '../config';
import { play } from './audio';

export type VibrationName = keyof typeof config.vibration.patterns;

let sessionTimer: ReturnType<typeof setInterval> | null = null;
let sessionIntensity = 1;

function clampIntensity(intensity: number): number {
  return intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
}

function sessionBurst(): void {
  if (sessionTimer == null) return;
  if (!config.vibration.enabled || !config.vibration.session.enabled || !vibrationSupported()) return;
  const burst = Math.round(config.vibration.session.burstMs * sessionIntensity);
  if (burst <= 0) return;
  navigator.vibrate(burst);
}

export function vibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(name: VibrationName): void {
  if (!config.vibration.enabled) return;
  if (!vibrationSupported()) {
    play('thump');
    return;
  }
  const pattern = config.vibration.patterns[name];
  if (pattern === 0) return;
  navigator.vibrate(pattern);
}

export function vibrateSessionStart(): void {
  if (!config.vibration.enabled || !config.vibration.session.enabled || !vibrationSupported()) return;
  if (sessionTimer != null) return;
  sessionTimer = setInterval(sessionBurst, config.vibration.session.intervalMs);
  sessionBurst();
}

export function vibrateSessionSetIntensity(intensity: number): void {
  sessionIntensity = clampIntensity(intensity);
}

export function vibrateSessionStop(): void {
  if (sessionTimer != null) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
  sessionIntensity = 1;
  if (vibrationSupported()) navigator.vibrate(0);
}
