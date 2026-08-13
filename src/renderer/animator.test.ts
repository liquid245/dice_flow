import { describe, it, expect } from 'vitest';
import { computeTransitions, type DieSnapshot } from './animator';

function snap(id: string, value: number, x = 0, y = 0): DieSnapshot {
  return { id, value, x, y };
}

describe('computeTransitions', () => {
  it('marks new dice as appear', () => {
    expect(computeTransitions([], [snap('a', 3, 0, 0)])).toEqual([
      { kind: 'appear', id: 'a', x: 0, y: 0, value: 3 },
    ]);
  });

  it('marks gone dice as remove', () => {
    expect(computeTransitions([snap('a', 3)], [])).toEqual([{ kind: 'remove', id: 'a', x: 0, y: 0 }]);
  });

  it('marks value or position change', () => {
    expect(computeTransitions([snap('a', 3, 0, 0)], [snap('a', 5, 0, -2)])).toEqual([
      { kind: 'change', id: 'a', fromX: 0, fromY: 0, toX: 0, toY: -2, fromValue: 3, toValue: 5 },
    ]);
  });

  it('returns nothing when unchanged', () => {
    expect(computeTransitions([snap('a', 3)], [snap('a', 3)])).toEqual([]);
  });

  it('handles a mix in one step', () => {
    const transitions = computeTransitions(
      [snap('a', 3), snap('b', 6)],
      [snap('a', 1), snap('c', 2)],
    );
    expect(transitions).toHaveLength(3);
    expect(transitions.some((t) => t.kind === 'change' && t.id === 'a')).toBe(true);
    expect(transitions.some((t) => t.kind === 'remove' && t.id === 'b')).toBe(true);
    expect(transitions.some((t) => t.kind === 'appear' && t.id === 'c')).toBe(true);
  });
});
