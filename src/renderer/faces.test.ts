import { describe, it, expect } from 'vitest';
import { faceArrangement } from './faces';

describe('faceArrangement', () => {
  it('places the value on the front and its opposite on the back', () => {
    const faces = faceArrangement(3);
    expect(faces[4]).toBe(3);
    expect(faces[5]).toBe(4);
  });

  it('uses each value exactly once', () => {
    for (let value = 1; value <= 6; value++) {
      const faces = faceArrangement(value);
      expect([...faces].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });
});
