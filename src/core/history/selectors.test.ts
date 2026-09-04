import { describe, it, expect } from 'vitest';
import { currentChunk } from './selectors';
import type { HistoryEntry } from './types';

function entry(kind: HistoryEntry['kind'], count = 1, value?: number): HistoryEntry {
  return { id: kind + Math.random(), timestamp: 0, kind, count, value };
}

describe('currentChunk', () => {
  it('returns the whole history before any clear', () => {
    const history = [entry('add', 3), entry('move', 1, 6), entry('delete', 1), entry('roll', 5)];
    expect(currentChunk(history).map((e) => e.kind)).toEqual(['add', 'move', 'delete', 'roll']);
  });

  it('returns entries after a clear without the clear marker', () => {
    const history = [entry('add', 2), entry('clear', 2), entry('add', 10), entry('roll', 5)];
    expect(currentChunk(history).map((e) => e.kind)).toEqual(['add', 'roll']);
  });

  it('returns empty immediately after a clear', () => {
    const history = [entry('add', 3), entry('clear', 3)];
    expect(currentChunk(history)).toEqual([]);
  });

  it('uses the most recent clear as the boundary', () => {
    const history = [entry('add', 1), entry('clear', 1), entry('roll', 5), entry('add', 2), entry('clear', 7), entry('move', 1, 5), entry('add', 2)];
    expect(currentChunk(history).map((e) => e.kind)).toEqual(['move', 'add']);
  });

  it('returns empty for empty history', () => {
    expect(currentChunk([])).toEqual([]);
  });

  it('keeps multiple rolls inside one chunk', () => {
    const history = [entry('roll', 5), entry('roll', 3)];
    expect(currentChunk(history).map((e) => e.kind)).toEqual(['roll', 'roll']);
  });
});
