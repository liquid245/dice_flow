import { describe, it, expect } from 'vitest';
import { plateOpacity } from './plateOpacity';

describe('plateOpacity', () => {
  it('returns min when no dice in group', () => {
    expect(plateOpacity(0, 0, 0.08, 0.25)).toBe(0.08);
  });

  it('returns min when none selected', () => {
    expect(plateOpacity(0, 3, 0.08, 0.25)).toBe(0.08);
  });

  it('returns max when all selected', () => {
    expect(plateOpacity(3, 3, 0.08, 0.25)).toBe(0.25);
  });

  it('interpolates for partial selection', () => {
    expect(plateOpacity(1, 4, 0.08, 0.25)).toBeCloseTo(0.1225);
  });
});
