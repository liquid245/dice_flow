import { describe, it, expect } from 'vitest';
import { reduce } from './reducer';
import { createInitialState } from './state';
import { noneSelection, selectedDice, type Selection } from '../selection/selection';
import type { Die } from '../dice/types';
import type { GameState } from './state';
import type { EngineDeps } from './deps';

function makeDeps(values: number[] = []): EngineDeps {
  let i = 0;
  let id = 0;
  let t = 0;
  return {
    random: () => values[i++] ?? 0,
    nextId: () => `d${++id}`,
    now: () => 1000 + t++,
  };
}

function die(id: string, value: number, origin: Die['origin'] = 'add'): Die {
  return { id, type: 'd6', value, origin };
}

function ids(...values: string[]): Selection {
  return { kind: 'ids', ids: new Set(values) };
}

const rand = (v: number) => (v - 1) / 6;

function stateWith(dice: Die[], selection: Selection = noneSelection): GameState {
  return { dice, history: [], swipeAddAvailable: false, rememberedValues: [], selection };
}

describe('add', () => {
  it('adds dice with random values and clears swipe availability', () => {
    const deps = makeDeps([rand(6), rand(3), rand(1)]);
    const state = reduce(createInitialState(), { type: 'add', count: 3 }, deps);
    expect(state.dice).toEqual([
      { id: 'd1', type: 'd6', value: 6, origin: 'add' },
      { id: 'd2', type: 'd6', value: 3, origin: 'add' },
      { id: 'd3', type: 'd6', value: 1, origin: 'add' },
    ]);
    expect(state.swipeAddAvailable).toBe(false);
  });

  it('uses explicit values when provided', () => {
    const state = reduce(createInitialState(), { type: 'add', count: 2, values: [5, 2] }, makeDeps([]));
    expect(state.dice.map((d) => d.value)).toEqual([5, 2]);
  });

  it('fills missing explicit values with random', () => {
    const state = reduce(createInitialState(), { type: 'add', count: 2, values: [5] }, makeDeps([rand(4)]));
    expect(state.dice.map((d) => d.value)).toEqual([5, 4]);
  });

  it('clears the existing selection', () => {
    const state = stateWith([die('a', 1), die('b', 2)], ids('a'));
    const next = reduce(state, { type: 'add', count: 1, values: [3] }, makeDeps([]));
    expect(next.dice.map((d) => d.id)).toEqual(['a', 'b', 'd1']);
    expect(next.selection).toEqual(noneSelection);
  });
});

describe('delete', () => {
  it('deletes selected dice', () => {
    const state = stateWith([die('a', 1), die('b', 2), die('c', 3)], ids('a', 'c'));
    const next = reduce(state, { type: 'delete' }, makeDeps([]));
    expect(next.dice.map((d) => d.id)).toEqual(['b']);
  });

  it('deletes the last added die when nothing is selected', () => {
    const state = stateWith([die('a', 1), die('b', 2), die('c', 3)]);
    const next = reduce(state, { type: 'delete' }, makeDeps([]));
    expect(next.dice.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('deletes the last N dice when a count is given', () => {
    const state = stateWith([die('a', 1), die('b', 2), die('c', 3)]);
    const next = reduce(state, { type: 'delete', count: 2 }, makeDeps([]));
    expect(next.dice.map((d) => d.id)).toEqual(['a']);
  });
});

describe('value memory', () => {
  it('re-adds a die with the last deleted value (LIFO)', () => {
    const deps = makeDeps([rand(6), rand(3), rand(5)]);
    let state = reduce(createInitialState(), { type: 'add', count: 3 }, deps);
    state = reduce(state, { type: 'delete', count: 2 }, deps);
    state = reduce(state, { type: 'add', count: 1 }, deps);
    expect(state.dice.map((d) => d.value)).toEqual([6, 5]);
  });

  it('restores all deleted values across multiple adds', () => {
    const deps = makeDeps([rand(6), rand(3), rand(5)]);
    let state = reduce(createInitialState(), { type: 'add', count: 3 }, deps);
    state = reduce(state, { type: 'delete', count: 2 }, deps);
    state = reduce(state, { type: 'add', count: 2 }, deps);
    expect(state.dice.map((d) => d.value)).toEqual([6, 5, 3]);
  });

  it('rolls fresh once the memory is exhausted', () => {
    const deps = makeDeps([rand(6), rand(3), rand(5)]);
    let state = reduce(createInitialState(), { type: 'add', count: 2 }, deps);
    state = reduce(state, { type: 'delete', count: 1 }, deps);
    state = reduce(state, { type: 'add', count: 2 }, deps);
    expect(state.dice.map((d) => d.value)).toEqual([6, 3, 5]);
  });

  it('remembers values of deleted selected dice', () => {
    const state = stateWith([die('a', 1), die('b', 2), die('c', 3)], ids('a', 'c'));
    const next = reduce(state, { type: 'delete' }, makeDeps([]));
    expect(next.rememberedValues).toEqual([1, 3]);
  });

  it('explicit values bypass the memory', () => {
    const state = { ...stateWith([]), rememberedValues: [5, 4] };
    const next = reduce(state, { type: 'add', count: 2, values: [6, 2] }, makeDeps([]));
    expect(next.dice.map((d) => d.value)).toEqual([6, 2]);
    expect(next.rememberedValues).toEqual([5, 4]);
  });

  it('roll resets the memory', () => {
    let state = { ...stateWith([die('a', 1), die('b', 2)]), rememberedValues: [5, 4] };
    state = reduce(state, { type: 'select', ids: ['a'], mode: 'set' }, makeDeps([]));
    const next = reduce(state, { type: 'roll' }, makeDeps([rand(6)]));
    expect(next.rememberedValues).toEqual([]);
  });

  it('reroll resets the memory', () => {
    const state = { ...stateWith([die('a', 1), die('b', 2)]), rememberedValues: [5, 4] };
    const next = reduce(state, { type: 'reroll' }, makeDeps([rand(6), rand(3)]));
    expect(next.rememberedValues).toEqual([]);
  });

  it('clear resets the memory', () => {
    const state = { ...stateWith([die('a', 1)]), rememberedValues: [5, 4] };
    const next = reduce(state, { type: 'clear' }, makeDeps([]));
    expect(next.rememberedValues).toEqual([]);
    expect(next.swipeAddAvailable).toBe(true);
  });
});

describe('roll', () => {
  it('rolls selected dice and removes unselected dice', () => {
    const state = stateWith([die('a', 1), die('b', 2), die('c', 3)], ids('a', 'c'));
    const deps = makeDeps([rand(6), rand(1)]);
    const next = reduce(state, { type: 'roll' }, deps);
    expect(next.dice.map((d) => d.id)).toEqual(['a', 'c']);
    expect(next.dice.map((d) => d.value)).toEqual([6, 1]);
    expect(next.dice.map((d) => d.origin)).toEqual(['roll', 'roll']);
    expect(next.selection).toEqual(noneSelection);
  });

  it('is a no-op when nothing is selected', () => {
    const state = stateWith([die('a', 1)]);
    expect(reduce(state, { type: 'roll' }, makeDeps([]))).toBe(state);
  });
});

describe('reroll', () => {
  it('rerolls only selected dice', () => {
    const state = stateWith([die('a', 6), die('b', 2), die('c', 6)], ids('a', 'c'));
    const deps = makeDeps([rand(1), rand(2)]);
    const next = reduce(state, { type: 'reroll' }, deps);
    expect(next.dice.find((d) => d.id === 'a')?.value).toBe(1);
    expect(next.dice.find((d) => d.id === 'c')?.value).toBe(2);
    expect(next.dice.find((d) => d.id === 'b')?.value).toBe(2);
  });

  it('rerolls every die when nothing is selected', () => {
    const state = stateWith([die('a', 1), die('b', 2), die('c', 3)]);
    const deps = makeDeps([rand(5), rand(4), rand(6)]);
    const next = reduce(state, { type: 'reroll' }, deps);
    expect(next.dice.map((d) => d.value)).toEqual([5, 4, 6]);
  });
});

describe('move', () => {
  it('moves selected dice to the target group', () => {
    const state = stateWith([die('a', 1), die('b', 2)], ids('a'));
    const next = reduce(state, { type: 'move', targetValue: 5 }, makeDeps([]));
    expect(next.dice.find((d) => d.id === 'a')?.value).toBe(5);
    expect(next.dice.find((d) => d.id === 'a')?.origin).toBe('move');
    expect(next.dice.find((d) => d.id === 'b')?.value).toBe(2);
  });
});

describe('select', () => {
  const state = stateWith([die('a', 1), die('b', 2), die('c', 3)]);

  it('sets the selection to exactly the given ids', () => {
    const next = reduce(state, { type: 'select', ids: ['a', 'c'], mode: 'set' }, makeDeps([]));
    expect(selectedDice(next.dice, next.selection).map((d) => d.id)).toEqual(['a', 'c']);
  });

  it('toggles the given ids', () => {
    const s0 = reduce(state, { type: 'select', ids: ['a'], mode: 'set' }, makeDeps([]));
    const next = reduce(s0, { type: 'select', ids: ['a', 'b'], mode: 'toggle' }, makeDeps([]));
    expect(selectedDice(next.dice, next.selection).map((d) => d.id)).toEqual(['b']);
  });

  it('adds and removes the given ids', () => {
    const s0 = reduce(state, { type: 'select', ids: ['a'], mode: 'set' }, makeDeps([]));
    const s1 = reduce(s0, { type: 'select', ids: ['b'], mode: 'add' }, makeDeps([]));
    expect(selectedDice(s1.dice, s1.selection).map((d) => d.id)).toEqual(['a', 'b']);
    const s2 = reduce(s1, { type: 'select', ids: ['a'], mode: 'remove' }, makeDeps([]));
    expect(selectedDice(s2.dice, s2.selection).map((d) => d.id)).toEqual(['b']);
  });

  it('replaces a group range with the given ids', () => {
    const s0 = reduce(state, { type: 'selectGroups', min: 1, max: 3 }, makeDeps([]));
    expect(s0.selection).toEqual({ kind: 'range', min: 1, max: 3 });
    const next = reduce(s0, { type: 'select', ids: ['a'], mode: 'set' }, makeDeps([]));
    expect(next.selection).toEqual(ids('a'));
  });
});

describe('selectGroups', () => {
  const state = stateWith([die('a', 1), die('b', 2), die('c', 3), die('d', 4), die('e', 5)]);

  it('selects all dice in the inclusive value range', () => {
    const next = reduce(state, { type: 'selectGroups', min: 2, max: 4 }, makeDeps([]));
    expect(selectedDice(next.dice, next.selection).map((d) => d.id)).toEqual(['b', 'c', 'd']);
    expect(next.selection).toEqual({ kind: 'range', min: 2, max: 4 });
  });

  it('is direction-agnostic', () => {
    const next = reduce(state, { type: 'selectGroups', min: 4, max: 2 }, makeDeps([]));
    expect(selectedDice(next.dice, next.selection).map((d) => d.id)).toEqual(['b', 'c', 'd']);
    expect(next.selection).toEqual({ kind: 'range', min: 2, max: 4 });
  });

  it('keeps the range for empty groups', () => {
    const next = reduce(state, { type: 'selectGroups', min: 3, max: 3 }, makeDeps([]));
    expect(selectedDice(next.dice, next.selection).map((d) => d.id)).toEqual(['c']);
    expect(next.selection).toEqual({ kind: 'range', min: 3, max: 3 });
  });

  it('returns the same state when the selection is unchanged', () => {
    const selected = reduce(state, { type: 'selectGroups', min: 2, max: 4 }, makeDeps([]));
    const again = reduce(selected, { type: 'selectGroups', min: 2, max: 4 }, makeDeps([]));
    expect(again).toBe(selected);
  });

  it('is cleared by a non-selection action', () => {
    const selected = reduce(state, { type: 'selectGroups', min: 2, max: 4 }, makeDeps([]));
    const moved = reduce(selected, { type: 'move', targetValue: 5 }, makeDeps([]));
    expect(moved.selection).toEqual(noneSelection);
  });
});

describe('clear', () => {
  it('empties the table and re-enables the swipe', () => {
    const state = stateWith([die('a', 1)]);
    const next = reduce(state, { type: 'clear' }, makeDeps([]));
    expect(next.dice).toEqual([]);
    expect(next.swipeAddAvailable).toBe(true);
  });
});

describe('selectors', () => {
  it('returns selected dice', () => {
    const dice = [die('a', 6), die('b', 6), die('c', 3), die('d', 1)];
    expect(selectedDice(dice, ids('a', 'c')).map((d) => d.id)).toEqual(['a', 'c']);
  });
});
