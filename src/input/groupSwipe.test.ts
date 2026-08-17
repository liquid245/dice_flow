import { describe, it, expect } from 'vitest';
import { selectRangeGroups, sameGroupRange } from './groupSwipe';

describe('selectRangeGroups', () => {
  it('emits a group-range select action', () => {
    expect(selectRangeGroups(1, 6)).toEqual({ type: 'selectGroups', min: 1, max: 6 });
  });

  it('is direction-agnostic', () => {
    expect(selectRangeGroups(5, 3)).toEqual({ type: 'selectGroups', min: 3, max: 5 });
  });

  it('returns a single group for equal endpoints', () => {
    expect(selectRangeGroups(2, 2)).toEqual({ type: 'selectGroups', min: 2, max: 2 });
  });
});

describe('sameGroupRange', () => {
  it('is false without a previous range', () => {
    expect(sameGroupRange(null, 1, 3)).toBe(false);
  });

  it('is direction-agnostic', () => {
    expect(sameGroupRange({ min: 2, max: 4 }, 4, 2)).toBe(true);
  });

  it('detects a changed range', () => {
    expect(sameGroupRange({ min: 2, max: 4 }, 2, 5)).toBe(false);
  });
});
