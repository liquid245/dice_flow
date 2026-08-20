import { config } from '../config';

export type VibrationName = keyof typeof config.vibration.patterns;

let sessionTimer: ReturnType<typeof setInterval> | null = null;

function supported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(name: VibrationName): void {
  if (!config.vibration.enabled || !supported()) return;
  const pattern = config.vibration.patterns[name];
  if (pattern === 0) return;
  navigator.vibrate(pattern);
}

export function vibrateSessionStart(): void {
  if (!config.vibration.enabled || !config.vibration.session.enabled || !supported()) return;
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
  if (supported()) navigator.vibrate(0);
}
