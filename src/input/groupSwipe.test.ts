import { describe, it, expect } from 'vitest';
import type { Die } from '../core/dice/types';
import { rangeGroupIds, selectRangeGroups } from './groupSwipe';

function die(id: string, value: number): Die {
  return { id, type: 'd6', value, selected: false, origin: 'add' };
}

describe('rangeGroupIds', () => {
  const dice = [die('a', 1), die('b', 3), die('c', 5), die('d', 2), die('e', 6)];

  it('selects all dice in the inclusive value range', () => {
    expect(rangeGroupIds(dice, 3, 5)).toEqual(['b', 'c']);
  });

  it('is direction-agnostic', () => {
    expect(rangeGroupIds(dice, 5, 3)).toEqual(['b', 'c']);
  });

  it('returns a single group for equal endpoints', () => {
    expect(rangeGroupIds(dice, 2, 2)).toEqual(['d']);
  });

  it('emits a set-select action', () => {
    expect(selectRangeGroups(dice, 1, 6)).toEqual({
      type: 'select',
      ids: ['a', 'b', 'c', 'd', 'e'],
      mode: 'set',
    });
  });
});
