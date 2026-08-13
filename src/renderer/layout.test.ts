import { describe, it, expect } from 'vitest';
import type { Die } from '../core/dice/types';
import { layout } from './layout';

function die(id: string, value: number): Die {
  return { id, type: 'd6', value, selected: false, origin: 'add' };
}

function diceOf(count: number, value: number): Die[] {
  return Array.from({ length: count }, (_, i) => die(`d${i}`, value));
}

describe('layout', () => {
  it('centers a single die', () => {
    const { positions } = layout([die('a', 6)], 4);
    expect(positions.get('a')).toEqual({ x: 0, y: -0.5, z: 0 });
  });

  it('balances 7 dice into rows of 4 and 3', () => {
    const { positions } = layout(diceOf(7, 6), 4);
    const counts = new Map<number, number>();
    for (const p of positions.values()) {
      const key = Math.round(p.y * 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect([...counts.values()].sort()).toEqual([3, 4]);
  });

  it('balances 9 dice into three rows of 3', () => {
    const { positions } = layout(diceOf(9, 6), 4);
    const counts = new Map<number, number>();
    for (const p of positions.values()) {
      const key = Math.round(p.y * 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect([...counts.values()].sort()).toEqual([3, 3, 3]);
  });

  it('keeps a group on a single row when it fits', () => {
    const { positions } = layout(diceOf(4, 6), 4);
    expect(new Set([...positions.values()].map((p) => p.y)).size).toBe(1);
  });

  it('stacks group 6 above group 1', () => {
    const { positions } = layout([die('a', 6), die('b', 1)], 4);
    expect(positions.get('a')!.y).toBeGreaterThan(positions.get('b')!.y);
  });

  it('emits a band per group even when empty', () => {
    const { bands, bounds } = layout([], 4);
    expect(bands).toHaveLength(6);
    expect(bounds.maxY).toBe(0);
    expect(bounds.minY).toBeLessThan(0);
  });

  it('grows a group vertically when it wraps', () => {
    const single = layout([die('a', 6)], 4);
    const wrapped = layout(diceOf(9, 6), 4);
    expect(wrapped.bounds.minY).toBeLessThan(single.bounds.minY);
  });
});
