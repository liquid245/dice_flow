import { describe, expect, it } from 'vitest';
import type { Die } from '../core/dice/types';
import type { HistoryEntry, HistoryKind } from '../core/history/types';
import type { Selection } from '../core/selection/selection';
import { currentIteration, describeSelection, formatAction, formatSelectionText } from './feed';

function entry(kind: HistoryKind, count = 0, value?: number): HistoryEntry {
  return { id: `${kind}-${Math.random()}`, timestamp: 0, kind, count, value };
}

function die(id: string, value: number): Die {
  return { id, type: 'd6', value, origin: 'roll' };
}

function idsSelection(ids: string[]): Selection {
  return { kind: 'ids', ids: new Set(ids) };
}

describe('describeSelection', () => {
  it('returns null when nothing is selected', () => {
    expect(describeSelection([die('a', 6), die('b', 5)], { kind: 'none' })).toBeNull();
  });

  it('compresses contiguous values reaching 6 as lo+', () => {
    const dice = [die('a', 6), die('b', 6), die('c', 5), die('d', 4)];
    const summary = describeSelection(dice, idsSelection(['a', 'b', 'c', 'd']));
    expect(summary).toEqual({ count: 4, valueText: '4+' });
    expect(formatSelectionText(summary as NonNullable<typeof summary>)).toBe('Sel 4 (4+)');
  });

  it('uses range selection kind', () => {
    const dice = [die('a', 6), die('b', 5), die('c', 4), die('d', 3)];
    const summary = describeSelection(dice, { kind: 'range', min: 4, max: 6 });
    expect(summary).toEqual({ count: 3, valueText: '4+' });
  });

  it('renders only sixes as 6+', () => {
    const dice = [die('a', 6), die('b', 6), die('c', 6)];
    expect(describeSelection(dice, idsSelection(['a', 'b']))).toEqual({ count: 2, valueText: '6+' });
  });

  it('pluralizes a single non-six value', () => {
    const dice = [die('a', 5), die('b', 5)];
    expect(describeSelection(dice, idsSelection(['a', 'b']))).toEqual({ count: 2, valueText: '5s' });
  });

  it('renders contiguous range without 6 as lo-hi', () => {
    const dice = [die('a', 1), die('b', 2), die('c', 3)];
    expect(describeSelection(dice, idsSelection(['a', 'b', 'c']))).toEqual({ count: 3, valueText: '1-3' });
  });

  it('lists non-contiguous values', () => {
    const dice = [die('a', 2), die('b', 5)];
    expect(describeSelection(dice, idsSelection(['a', 'b']))).toEqual({ count: 2, valueText: '2, 5' });
  });
});

describe('formatAction', () => {
  it('formats roll with count and grouped result', () => {
    expect(formatAction({ ...entry('roll', 5), after: [6, 6, 5, 5, 5] })).toBe('Roll 5 → 6×2, 5×3');
  });

  it('formats roll without stored result as verb only', () => {
    expect(formatAction(entry('roll', 20))).toBe('Roll');
  });

  it('formats reroll with before and after', () => {
    expect(formatAction({ ...entry('reroll', 4, 6), before: [6, 6, 6, 6], after: [6, 6, 5, 3] })).toBe(
      'Reroll 4 6+ → 6×2, 5, 3',
    );
  });

  it('formats reroll with only a stored result', () => {
    expect(formatAction({ ...entry('reroll', 2), after: [4, 3] })).toBe('Reroll 2 → 4, 3');
  });

  it('formats legacy reroll with uniform value', () => {
    expect(formatAction(entry('reroll', 4, 6))).toBe('Reroll 4 6+');
  });

  it('formats legacy reroll without value', () => {
    expect(formatAction(entry('reroll', 6))).toBe('Reroll 6');
  });

  it('formats add', () => {
    expect(formatAction(entry('add', 5))).toBe('Add 5');
  });

  it('formats delete', () => {
    expect(formatAction(entry('delete', 3))).toBe('Remove 3');
  });

  it('formats move with target value', () => {
    expect(formatAction(entry('move', 7, 6))).toBe('Move 7 → 6');
  });

  it('formats clear', () => {
    expect(formatAction(entry('clear', 24))).toBe('Clear');
  });
});

describe('currentIteration', () => {
  it('slices from the last roll', () => {
    const history = [entry('add', 5), entry('roll', 5), entry('reroll', 2), entry('add', 1)];
    expect(currentIteration(history).map((e) => e.kind)).toEqual(['roll', 'reroll', 'add']);
  });

  it('slices from the last clear', () => {
    const history = [entry('roll', 5), entry('clear', 5), entry('add', 10)];
    expect(currentIteration(history).map((e) => e.kind)).toEqual(['clear', 'add']);
  });

  it('returns the whole history before any roll or clear', () => {
    const history = [entry('add', 10), entry('add', 5)];
    expect(currentIteration(history).map((e) => e.kind)).toEqual(['add', 'add']);
  });
});
