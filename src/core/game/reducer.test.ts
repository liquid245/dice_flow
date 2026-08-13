import { describe, it, expect } from 'vitest';
import { reduce } from './reducer';
import { createInitialState } from './state';
import { groupByValue, countsByValue } from '../groups/groups';
import { selectedDice } from '../selection/selection';
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

function die(id: string, value: number, selected = false, origin: Die['origin'] = 'add'): Die {
  return { id, type: 'd6', value, selected, origin };
}

const rand = (v: number) => (v - 1) / 6;

function stateWith(dice: Die[]): GameState {
  return { dice, history: [], swipeAddAvailable: false };
}

describe('add', () => {
  it('adds dice with random values and clears swipe availability', () => {
    const deps = makeDeps([rand(6), rand(3), rand(1)]);
    const state = reduce(createInitialState(), { type: 'add', count: 3 }, deps);
    expect(state.dice).toEqual([
      { id: 'd1', type: 'd6', value: 6, selected: false, origin: 'add' },
      { id: 'd2', type: 'd6', value: 3, selected: false, origin: 'add' },
      { id: 'd3', type: 'd6', value: 1, selected: false, origin: 'add' },
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
});

describe('delete', () => {
  it('deletes selected dice', () => {
    const state = stateWith([die('a', 1, true), die('b', 2), die('c', 3, true)]);
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

describe('roll', () => {
  it('rolls selected dice and removes unselected dice', () => {
    const state = stateWith([die('a', 1, true), die('b', 2, false), die('c', 3, true)]);
    const deps = makeDeps([rand(6), rand(1)]);
    const next = reduce(state, { type: 'roll' }, deps);
    expect(next.dice.map((d) => d.id)).toEqual(['a', 'c']);
    expect(next.dice.map((d) => d.value)).toEqual([6, 1]);
    expect(next.dice.map((d) => d.origin)).toEqual(['roll', 'roll']);
    expect(next.dice.every((d) => !d.selected)).toBe(true);
  });

  it('is a no-op when nothing is selected', () => {
    const state = stateWith([die('a', 1)]);
    expect(reduce(state, { type: 'roll' }, makeDeps([]))).toBe(state);
  });
});

describe('reroll', () => {
  it('rerolls only selected dice', () => {
    const state = stateWith([die('a', 6, true), die('b', 2), die('c', 6, true)]);
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
    const state = stateWith([die('a', 1, true), die('b', 2)]);
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
    expect(selectedDice(next.dice).map((d) => d.id)).toEqual(['a', 'c']);
  });

  it('toggles the given ids', () => {
    const s0 = reduce(state, { type: 'select', ids: ['a'], mode: 'set' }, makeDeps([]));
    const next = reduce(s0, { type: 'select', ids: ['a', 'b'], mode: 'toggle' }, makeDeps([]));
    expect(selectedDice(next.dice).map((d) => d.id)).toEqual(['b']);
  });

  it('adds and removes the given ids', () => {
    const s0 = reduce(state, { type: 'select', ids: ['a'], mode: 'set' }, makeDeps([]));
    const s1 = reduce(s0, { type: 'select', ids: ['b'], mode: 'add' }, makeDeps([]));
    expect(selectedDice(s1.dice).map((d) => d.id)).toEqual(['a', 'b']);
    const s2 = reduce(s1, { type: 'select', ids: ['a'], mode: 'remove' }, makeDeps([]));
    expect(selectedDice(s2.dice).map((d) => d.id)).toEqual(['b']);
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
  const dice = [die('a', 6, true), die('b', 6), die('c', 3, true), die('d', 1)];

  it('groups dice by value', () => {
    const groups = groupByValue(dice);
    expect(groups.get(6)?.map((d) => d.id)).toEqual(['a', 'b']);
    expect(groups.get(3)?.map((d) => d.id)).toEqual(['c']);
    expect(groups.get(1)?.map((d) => d.id)).toEqual(['d']);
  });

  it('counts dice by value', () => {
    const counts = countsByValue(dice);
    expect(counts.get(6)).toBe(2);
    expect(counts.get(3)).toBe(1);
    expect(counts.get(1)).toBe(1);
    expect(counts.get(2)).toBeUndefined();
  });

  it('returns selected dice', () => {
    expect(selectedDice(dice).map((d) => d.id)).toEqual(['a', 'c']);
  });
});
