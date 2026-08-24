import { config } from '../config';
import { playThump } from './audio';

export type VibrationName = keyof typeof config.vibration.patterns;

let sessionTimer: ReturnType<typeof setInterval> | null = null;

export function vibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(name: VibrationName, opts?: { sound?: boolean }): void {
  if (!config.vibration.enabled) return;
  if (!vibrationSupported()) {
    playThump();
    return;
  }
  const pattern = config.vibration.patterns[name];
  if (pattern === 0) return;
  navigator.vibrate(pattern);
  if (opts?.sound) playThump();
}

export function vibrateSessionStart(): void {
  if (!config.vibration.enabled || !config.vibration.session.enabled || !vibrationSupported()) return;
  if (sessionTimer != null) return;
  const { burstMs, intervalMs } = config.vibration.session;
  navigator.vibrate(burstMs);
  sessionTimer = setInterval(() => navigator.vibrate(burstMs), intervalMs);
}

export function vibrateSessionStop(): void {
  if (sessionTimer != null) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
  if (vibrationSupported()) navigator.vibrate(0);
}
