import { describe, expect, it } from 'vitest';
import type { Die } from '../core/dice/types';
import type { HistoryEntry, HistoryKind } from '../core/history/types';
import type { Selection } from '../core/selection/selection';
import { buildHistoryFeed, describeSelection, formatAction, formatSelectionText } from './feed';

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

describe('buildHistoryFeed', () => {
  function roll(count: number, values: number[]): HistoryEntry {
    return { ...entry('roll', count), after: values };
  }

  it('shows the swipe hint when there are no dice', () => {
    const feed = buildHistoryFeed([], [roll(5, [6, 6, 5, 5, 5])], 'Swipe to add');
    expect(feed.system).toBe('Swipe to add');
    expect(feed.summary).toBe('');
    expect(feed.rows).toEqual([]);
    expect(feed.active).toBe(false);
  });

  it('shows the dice count when dice exist but the chunk is empty', () => {
    const feed = buildHistoryFeed([die('a', 6), die('b', 5), die('c', 4)], [], 'Swipe to add');
    expect(feed.system).toBeNull();
    expect(feed.summary).toBe('3 dice');
    expect(feed.rows).toEqual([]);
    expect(feed.active).toBe(false);
  });

  it('builds a single summary from the last roll', () => {
    const history = [roll(5, [6, 6, 5, 5, 5]), { ...entry('add', 1), count: 1 } as HistoryEntry];
    const dice = [die('a', 6), die('b', 6), die('c', 5), die('d', 5), die('e', 5), die('f', 6)];
    const feed = buildHistoryFeed(dice, history, 'Swipe to add');
    expect(feed.system).toBeNull();
    expect(feed.summary).toBe('Roll 5 → 6×2, 5×3 · 6 dice');
    expect(feed.rows).toEqual(['Roll 5 → 6×2, 5×3', 'Add 1']);
    expect(feed.active).toBe(true);
  });

  it('keeps the last roll on view after later add/move entries', () => {
    const history = [roll(5, [6, 6, 5, 5, 5]), { ...entry('add', 1) } as HistoryEntry];
    const dice = [die('a', 6), die('b', 6), die('c', 5), die('d', 5), die('e', 5), die('f', 4)];
    const feed = buildHistoryFeed(dice, history, 'Swipe to add');
    expect(feed.summary).toBe('Roll 5 → 6×2, 5×3 · 6 dice');
  });

  it('is inactive with a single entry', () => {
    const history = [roll(3, [6, 5, 4])];
    const dice = [die('a', 6), die('b', 5), die('c', 4)];
    const feed = buildHistoryFeed(dice, history, 'Swipe to add');
    expect(feed.active).toBe(false);
    expect(feed.summary).toBe('Roll 3 → 6, 5, 4 · 3 dice');
    expect(feed.rows).toEqual(['Roll 3 → 6, 5, 4']);
  });

  it('falls back to the latest entry when no roll exists yet', () => {
    const history = [{ ...entry('add', 3) } as HistoryEntry];
    const dice = [die('a', 1), die('b', 2), die('c', 3)];
    const feed = buildHistoryFeed(dice, history, 'Swipe to add');
    expect(feed.summary).toBe('Add 3 · 3 dice');
    expect(feed.active).toBe(false);
  });

  it('slices history by clear and hides the clear marker', () => {
    const history = [roll(5, [6, 5, 5, 4, 3]), { ...entry('clear', 5) } as HistoryEntry, roll(2, [6, 1])];
    const dice = [die('a', 6), die('b', 1)];
    const feed = buildHistoryFeed(dice, history, 'Swipe to add');
    expect(feed.rows).toEqual(['Roll 2 → 6, 1']);
    expect(feed.active).toBe(false);
  });
});
