import { describe, it, expect } from 'vitest';
import type { Die } from '../core/dice/types';
import { layout, columnsFor } from './layout';

function die(id: string, value: number): Die {
  return { id, type: 'd6', value, selected: false, origin: 'add' };
}

function diceOf(count: number, value: number, prefix = ''): Die[] {
  return Array.from({ length: count }, (_, i) => die(`${prefix}d${i}`, value));
}

function rowCounts(positions: Map<string, { x: number; y: number; z: number }>): number[] {
  const counts = new Map<number, number>();
  for (const p of positions.values()) {
    const key = Math.round(p.y * 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].sort((a, b) => b - a);
}

describe('columnsFor', () => {
  it('returns 1 with no or a single die', () => {
    expect(columnsFor([], 1, 10)).toBe(1);
    expect(columnsFor([1], 1, 10)).toBe(1);
  });

  it('squares a single group', () => {
    expect(columnsFor([9], 1, 10)).toBe(3);
    expect(columnsFor([16], 1, 10)).toBe(4);
  });

  it('uses more columns in landscape', () => {
    expect(columnsFor([9], 2, 10)).toBe(5);
  });

  it('uses fewer columns in portrait', () => {
    expect(columnsFor([2], 0.5, 10)).toBe(1);
  });

  it('accounts for the number of groups', () => {
    expect(columnsFor([4, 4], 1, 10)).toBe(3);
  });

  it('caps at maxPerRow', () => {
    expect(columnsFor([100], 1, 10)).toBe(10);
  });
});

describe('layout', () => {
  it('centers a single die', () => {
    const { positions } = layout([die('a', 6)], 10, 1);
    expect(positions.get('a')).toEqual({ x: 0, y: -0.5, z: 0 });
  });

  it('balances 7 dice into rows of 3, 2, 2 with square aspect', () => {
    const { positions } = layout(diceOf(7, 6), 10, 1);
    expect(rowCounts(positions)).toEqual([3, 2, 2]);
  });

  it('stacks a small group vertically in portrait', () => {
    const { positions } = layout(diceOf(3, 6), 10, 0.5);
    expect(new Set([...positions.values()].map((p) => p.y)).size).toBe(3);
  });

  it('spreads dice wider across several groups', () => {
    const { positions } = layout([...diceOf(4, 6, 'a'), ...diceOf(4, 5, 'b')], 10, 1);
    expect(new Set([...positions.values()].map((p) => p.y)).size).toBe(4);
  });

  it('stacks group 6 above group 1', () => {
    const { positions } = layout([die('a', 6), die('b', 1)], 10, 1);
    expect(positions.get('a')!.y).toBeGreaterThan(positions.get('b')!.y);
  });

  it('emits a band per group even when empty', () => {
    const { bands, bounds } = layout([], 10, 1);
    expect(bands).toHaveLength(6);
    expect(bounds.maxY).toBe(0);
    expect(bounds.minY).toBeLessThan(0);
  });

  it('grows a group vertically when it wraps', () => {
    const single = layout([die('a', 6)], 10, 1);
    const wrapped = layout(diceOf(9, 6), 10, 1);
    expect(wrapped.bounds.minY).toBeLessThan(single.bounds.minY);
  });
});
