import { describe, it, expect } from 'vitest';
import type { Die } from '../core/dice/types';
import { layout } from './layout';

function die(id: string, value: number): Die {
  return { id, type: 'd6', value, selected: false, origin: 'add' };
}

function diceOf(count: number, value: number, prefix = ''): Die[] {
  return Array.from({ length: count }, (_, i) => die(`${prefix}d${i}`, value));
}

function yLevels(positions: Map<string, { x: number; y: number; z: number }>): number {
  return new Set([...positions.values()].map((p) => Math.round(p.y * 100))).size;
}

function rowCounts(positions: Map<string, { x: number; y: number; z: number }>): number[] {
  const counts = new Map<number, number>();
  for (const p of positions.values()) {
    const key = Math.round(p.y * 100);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].sort((a, b) => b - a);
}

describe('layout', () => {
  it('centers a single die', () => {
    const { positions } = layout([die('a', 6)], 20, 1);
    expect(positions.get('a')).toEqual({ x: 0, y: -0.5, z: 0 });
  });

  it('squares a single group', () => {
    const { positions } = layout(diceOf(9, 6), 20, 1);
    expect(rowCounts(positions)).toEqual([3, 3, 3]);
  });

  it('uses more columns in landscape', () => {
    const { positions } = layout(diceOf(9, 6), 20, 2);
    expect(rowCounts(positions)).toEqual([5, 4]);
  });

  it('uses fewer columns in portrait', () => {
    const { positions } = layout(diceOf(9, 6), 20, 0.5);
    expect(rowCounts(positions)).toEqual([2, 2, 2, 2, 1]);
  });

  it('stacks a small group vertically in portrait', () => {
    const { positions } = layout(diceOf(3, 6), 20, 0.5);
    expect(yLevels(positions)).toBe(3);
  });

  it('gives a large group more columns than a small group', () => {
    const dice = [...diceOf(12, 6, 'a'), ...diceOf(2, 5, 'b')];
    const { positions } = layout(dice, 20, 1);
    const sixes = new Set([...positions.values()].filter((_, i) => i < 12).map((p) => Math.round(p.y * 100)));
    const fives = new Set([...positions.values()].filter((_, i) => i >= 12).map((p) => Math.round(p.y * 100)));
    expect(sixes.size).toBe(3);
    expect(fives.size).toBe(1);
  });

  it('stacks group 6 above group 1', () => {
    const { positions } = layout([die('a', 6), die('b', 1)], 20, 1);
    expect(positions.get('a')!.y).toBeGreaterThan(positions.get('b')!.y);
  });

  it('caps columns at maxPerRow', () => {
    const { positions } = layout(diceOf(400, 6), 20, 1);
    expect(yLevels(positions)).toBe(20);
  });

  it('emits a band per group even when empty', () => {
    const { bands, bounds } = layout([], 20, 1);
    expect(bands).toHaveLength(6);
    expect(bounds.maxY).toBe(0);
    expect(bounds.minY).toBeLessThan(0);
  });
});
