import { describe, it, expect } from 'vitest';
import { selectRangeGroups } from './groupSwipe';

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
