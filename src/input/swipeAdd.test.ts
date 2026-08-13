import { describe, it, expect } from 'vitest';
import { SwipeAddSession } from './swipeAdd';

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('SwipeAddSession', () => {
  it('adds dice when the count grows', () => {
    const session = new SwipeAddSession(seq([1, 2, 3, 4, 5]));
    expect(session.setCount(3)).toEqual([{ type: 'add', count: 3, values: [1, 2, 3] }]);
  });

  it('emits no actions for an unchanged count', () => {
    const session = new SwipeAddSession(seq([1, 2, 3]));
    session.setCount(3);
    expect(session.setCount(3)).toEqual([]);
  });

  it('deletes dice when the count shrinks', () => {
    const session = new SwipeAddSession(seq([1, 2, 3, 4, 5]));
    session.setCount(5);
    expect(session.setCount(2)).toEqual([{ type: 'delete', count: 3 }]);
  });

  it('restores remembered values after a shrink', () => {
    const session = new SwipeAddSession(seq([1, 2, 3, 4, 5]));
    session.setCount(5);
    session.setCount(2);
    expect(session.setCount(5)).toEqual([{ type: 'add', count: 3, values: [3, 4, 5] }]);
  });

  it('clamps negative targets to zero', () => {
    const session = new SwipeAddSession(seq([1, 2]));
    session.setCount(2);
    expect(session.setCount(-5)).toEqual([{ type: 'delete', count: 2 }]);
  });

  it('generates fresh values beyond the remembered ones', () => {
    const session = new SwipeAddSession(seq([1, 2, 3, 4]));
    session.setCount(3);
    session.setCount(1);
    expect(session.setCount(4)).toEqual([{ type: 'add', count: 3, values: [2, 3, 4] }]);
  });
});
