import { describe, it, expect } from 'vitest';
import {
  easeOutCubic,
  startMotion,
  motionValue,
  motionProgress,
  motionDone,
  clamp01,
} from './motion';

describe('easeOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('is monotonic and slows near the end', () => {
    expect(easeOutCubic(0.25)).toBeGreaterThan(0);
    expect(easeOutCubic(0.5)).toBeGreaterThan(easeOutCubic(0.25));
    expect(easeOutCubic(0.75)).toBeGreaterThan(easeOutCubic(0.5));
    expect(easeOutCubic(0.75)).toBeLessThan(1);
  });
});

describe('clamp01', () => {
  it('clamps negative and above-one values', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe('motion', () => {
  it('returns the from value at start', () => {
    const m = startMotion(2, 6, 100, 200);
    expect(motionValue(m, 100)).toBe(2);
  });

  it('reaches the target value once done', () => {
    const m = startMotion(2, 6, 100, 200);
    expect(motionValue(m, 300)).toBeCloseTo(6, 10);
  });

  it('interpolates between from and to', () => {
    const m = startMotion(0, 10, 0, 100);
    const v = motionValue(m, 50);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(10);
  });

  it('reports progress and completion', () => {
    const m = startMotion(0, 1, 0, 100);
    expect(motionProgress(m, 50)).toBeCloseTo(0.5, 10);
    expect(motionDone(m, 50)).toBe(false);
    expect(motionDone(m, 100)).toBe(true);
  });

  it('clamps values past the end', () => {
    const m = startMotion(0, 10, 0, 100);
    expect(motionValue(m, 500)).toBe(10);
  });

  it('completes immediately with zero duration', () => {
    const m = startMotion(3, 9, 0, 0);
    expect(motionDone(m, 0)).toBe(true);
    expect(motionValue(m, 0)).toBe(9);
  });
});
