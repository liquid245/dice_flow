import { describe, it, expect } from 'vitest';
import { changesSinceLastRoll } from './selectors';
import type { HistoryEntry } from './types';

function entry(kind: HistoryEntry['kind'], count = 1, value?: number): HistoryEntry {
  return { id: kind + Math.random(), timestamp: 0, kind, count, value };
}

describe('changesSinceLastRoll', () => {
  it('returns everything before the first roll', () => {
    const history = [entry('add', 3), entry('move', 1, 6), entry('delete', 1)];
    expect(changesSinceLastRoll(history).map((e) => e.kind)).toEqual(['add', 'move', 'delete']);
  });

  it('returns only actions after the last roll', () => {
    const history = [entry('roll'), entry('add', 3), entry('move', 1, 6)];
    expect(changesSinceLastRoll(history).map((e) => e.kind)).toEqual(['add', 'move']);
  });

  it('returns empty immediately after a roll', () => {
    const history = [entry('add', 3), entry('roll')];
    expect(changesSinceLastRoll(history)).toEqual([]);
  });

  it('resets after clear', () => {
    const history = [entry('add', 2), entry('clear', 2)];
    expect(changesSinceLastRoll(history)).toEqual([]);
  });

  it('uses the most recent roll/clear as the boundary', () => {
    const history = [entry('roll'), entry('add', 1), entry('roll'), entry('move', 1, 5), entry('clear', 4), entry('add', 2)];
    expect(changesSinceLastRoll(history).map((e) => e.kind)).toEqual(['add']);
  });

  it('includes reroll as a change within the round', () => {
    const history = [entry('roll'), entry('reroll', 2, 6), entry('add', 1)];
    expect(changesSinceLastRoll(history).map((e) => e.kind)).toEqual(['reroll', 'add']);
  });
});
