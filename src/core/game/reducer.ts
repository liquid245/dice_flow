import { isD6Value, type Die } from '../dice/types';
import { rollD6 } from '../dice/roll';
import type { GameAction, SelectMode } from '../actions/types';
import type { GameState } from './state';
import type { EngineDeps } from './deps';
import { noneSelection, selectedDice, selectedIds } from '../selection/selection';

export function reduce(state: GameState, action: GameAction, deps: EngineDeps): GameState {
  switch (action.type) {
    case 'add':
      return addDice(state, action.count, action.values, deps);
    case 'delete':
      return deleteDice(state, action.count);
    case 'roll':
      return roll(state, deps);
    case 'reroll':
      return reroll(state, deps);
    case 'move':
      return move(state, action.targetValue);
    case 'select':
      return select(state, action.ids, action.mode);
    case 'selectGroups':
      return selectGroupRange(state, action.min, action.max);
    case 'clear':
      return clear(state);
  }
}

function addDice(state: GameState, count: number, values: number[] | undefined, deps: EngineDeps): GameState {
  if (count <= 0) return state;
  const added: Die[] = [];
  for (let i = 0; i < count; i++) {
    const explicitValue = values?.[i];
    const value = isD6Value(explicitValue) ? explicitValue : rollD6(deps.random);
    added.push({
      id: deps.nextId(),
      type: 'd6',
      value,
      origin: 'add',
    });
  }
  return {
    ...state,
    dice: [...state.dice, ...added],
    selection: noneSelection,
  };
}

function deleteDice(state: GameState, count: number | undefined): GameState {
  const selected = selectedDice(state.dice, state.selection);
  let remaining: Die[];
  if (selected.length > 0) {
    const ids = new Set(selected.map((d) => d.id));
    remaining = state.dice.filter((d) => !ids.has(d.id));
  } else {
    const n = Math.max(0, count ?? 1);
    if (n === 0 || state.dice.length === 0) return state;
    remaining = state.dice.slice(0, state.dice.length - n);
  }
  return {
    ...state,
    dice: remaining,
    selection: noneSelection,
  };
}

function roll(state: GameState, deps: EngineDeps): GameState {
  const selected = selectedDice(state.dice, state.selection);
  if (selected.length === 0) return state;
  const ids = new Set(selected.map((d) => d.id));
  const dice: Die[] = state.dice
    .filter((d) => ids.has(d.id))
    .map((d) => ({ ...d, value: rollD6(deps.random), origin: 'roll' as const, rev: (d.rev ?? 0) + 1 }));
  return { ...state, dice, selection: noneSelection };
}

function reroll(state: GameState, deps: EngineDeps): GameState {
  const selected = selectedDice(state.dice, state.selection);
  const ids = new Set(
    (selected.length > 0 ? selected : state.dice).map((d) => d.id),
  );
  if (ids.size === 0) return state;
  const dice: Die[] = state.dice.map((d) =>
    ids.has(d.id)
      ? { ...d, value: rollD6(deps.random), origin: 'reroll' as const, rev: (d.rev ?? 0) + 1 }
      : d,
  );
  return { ...state, dice, selection: noneSelection };
}

function move(state: GameState, targetValue: number): GameState {
  if (!isD6Value(targetValue)) return state;
  const selected = selectedDice(state.dice, state.selection);
  if (selected.length === 0) return state;
  const ids = new Set(selected.map((d) => d.id));
  const dice: Die[] = state.dice.map((d) =>
    ids.has(d.id) ? { ...d, value: targetValue, origin: 'move' as const } : d,
  );
  return { ...state, dice, selection: noneSelection };
}

function select(state: GameState, ids: string[], mode: SelectMode): GameState {
  const idSet = new Set(ids);
  const current = selectedIds(state.dice, state.selection);
  let next: Set<string>;
  switch (mode) {
    case 'set':
      next = new Set(idSet);
      break;
    case 'toggle': {
      next = new Set(current);
      for (const id of idSet) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      break;
    }
    case 'add': {
      next = new Set(current);
      for (const id of idSet) next.add(id);
      break;
    }
    case 'remove': {
      next = new Set(current);
      for (const id of idSet) next.delete(id);
      break;
    }
  }
  return { ...state, selection: next.size === 0 ? noneSelection : { kind: 'ids', ids: next } };
}

function selectGroupRange(state: GameState, min: number, max: number): GameState {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const selection = state.selection;
  if (selection.kind === 'range' && selection.min === lo && selection.max === hi) return state;
  return { ...state, selection: { kind: 'range', min: lo, max: hi } };
}

function clear(state: GameState): GameState {
  return { ...state, dice: [], selection: noneSelection };
}
