import { describe, it, expect } from 'vitest';
import type { Die } from '../core/dice/types';
import { groupY, valueFromY, layoutPositions, MAX_PER_ROW } from './layout';

function die(id: string, value: number): Die {
  return { id, type: 'd6', value, selected: false, origin: 'add' };
}

describe('groupY', () => {
  it('places group 6 at the top', () => {
    expect(groupY(6)).toBe(0);
  });

  it('stacks group 1 below', () => {
    expect(groupY(1)).toBe(-10);
  });
});

describe('valueFromY', () => {
  it('maps world Y back to a group value', () => {
    expect(valueFromY(0)).toBe(6);
    expect(valueFromY(-4)).toBe(4);
    expect(valueFromY(-10)).toBe(1);
  });

  it('clamps out-of-range Y to 1..6', () => {
    expect(valueFromY(50)).toBe(6);
    expect(valueFromY(-50)).toBe(1);
  });
});

describe('layoutPositions', () => {
  it('centers a single group row', () => {
    const positions = layoutPositions([die('a', 6), die('b', 6), die('c', 6)]);
    expect(positions.get('a')).toEqual({ x: -1.3, y: 0, z: 0 });
    expect(positions.get('b')).toEqual({ x: 0, y: 0, z: 0 });
    expect(positions.get('c')).toEqual({ x: 1.3, y: 0, z: 0 });
  });

  it('separates groups vertically', () => {
    const positions = layoutPositions([die('a', 6), die('b', 1)]);
    expect(positions.get('a')?.y).toBe(0);
    expect(positions.get('b')?.y).toBe(-10);
  });

  it('wraps dice into additional rows', () => {
    const dice = Array.from({ length: MAX_PER_ROW + 2 }, (_, i) => die(`d${i}`, 3));
    const positions = layoutPositions(dice);
    expect(positions.get(`d${MAX_PER_ROW}`)?.y).toBeLessThan(positions.get('d0')!.y);
  });
});
