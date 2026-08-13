import { describe, it, expect } from 'vitest';
import { exceedsThreshold, moveTarget } from './dragMove';

describe('exceedsThreshold', () => {
  it('is false below the threshold', () => {
    expect(exceedsThreshold(0, 0, 5, 5)).toBe(false);
  });

  it('is true beyond the threshold', () => {
    expect(exceedsThreshold(0, 0, 6, 6)).toBe(true);
  });
});

describe('moveTarget', () => {
  it('returns a move for a valid target group', () => {
    expect(moveTarget(2, 1, 5)).toEqual({ type: 'move', targetValue: 5 });
  });

  it('rejects an undefined target', () => {
    expect(moveTarget(2, 1, undefined)).toBeNull();
  });

  it('rejects an out-of-range target', () => {
    expect(moveTarget(2, 1, 7)).toBeNull();
    expect(moveTarget(2, 1, 0)).toBeNull();
  });

  it('no-ops when a single die drops on its own group', () => {
    expect(moveTarget(2, 1, 2)).toBeNull();
  });

  it('still moves multiple selected dice onto the dragged die group', () => {
    expect(moveTarget(2, 3, 2)).toEqual({ type: 'move', targetValue: 2 });
  });
});
