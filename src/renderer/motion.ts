export type Ease = (t: number) => number;

export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);

export interface Motion {
  from: number;
  to: number;
  start: number;
  duration: number;
}

export function startMotion(from: number, to: number, start: number, duration: number): Motion {
  return { from, to, start, duration };
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function motionProgress(m: Motion, now: number): number {
  return m.duration <= 0 ? 1 : clamp01((now - m.start) / m.duration);
}

export function motionValue(m: Motion, now: number): number {
  const t = motionProgress(m, now);
  return m.from + (m.to - m.from) * easeOutCubic(t);
}

export function motionDone(m: Motion, now: number): boolean {
  return now - m.start >= m.duration;
}
