import type { Die } from '../dice/types';
import { rollD6 } from '../dice/roll';
import type { GameAction, SelectMode } from '../actions/types';
import type { GameState } from './state';
import type { EngineDeps } from './deps';

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
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

function addDice(state: GameState, count: number, values: number[] | undefined, deps: EngineDeps): GameState {
  if (count <= 0) return state;
  const memory = [...(state.rememberedValues ?? [])];
  const added: Die[] = [];
  for (let i = 0; i < count; i++) {
    let value: number;
    if (values && i < values.length) {
      value = values[i];
    } else if (memory.length > 0) {
      value = memory.pop() as number;
    } else {
      value = rollD6(deps.random);
    }
    added.push({
      id: deps.nextId(),
      type: 'd6',
      value,
      selected: false,
      origin: 'add',
    });
  }
  return {
    ...state,
    dice: [...state.dice.map((d) => (d.selected ? { ...d, selected: false } : d)), ...added],
    swipeAddAvailable: false,
    rememberedValues: memory,
    selectedGroups: null,
  };
}

function deleteDice(state: GameState, count: number | undefined): GameState {
  const selected = state.dice.filter((d) => d.selected);
  let deleted: Die[];
  let remaining: Die[];
  if (selected.length > 0) {
    const ids = new Set(selected.map((d) => d.id));
    deleted = selected;
    remaining = state.dice.filter((d) => !ids.has(d.id));
  } else {
    const n = Math.max(0, count ?? 1);
    if (n === 0 || state.dice.length === 0) return state;
    deleted = state.dice.slice(state.dice.length - n);
    remaining = state.dice.slice(0, state.dice.length - n);
  }
  const memory = [...(state.rememberedValues ?? [])];
  for (const die of deleted) memory.push(die.value);
  return {
    ...state,
    dice: remaining,
    swipeAddAvailable: false,
    rememberedValues: memory,
    selectedGroups: null,
  };
}

function roll(state: GameState, deps: EngineDeps): GameState {
  const selected = state.dice.filter((d) => d.selected);
  if (selected.length === 0) return state;
  const ids = new Set(selected.map((d) => d.id));
  const dice: Die[] = state.dice
    .filter((d) => ids.has(d.id))
    .map((d) => ({ ...d, value: rollD6(deps.random), selected: false, origin: 'roll' }));
  return { ...state, dice, rememberedValues: [], selectedGroups: null };
}

function reroll(state: GameState, deps: EngineDeps): GameState {
  const selected = state.dice.filter((d) => d.selected);
  const ids = new Set(
    (selected.length > 0 ? selected : state.dice).map((d) => d.id),
  );
  if (ids.size === 0) return state;
  const dice: Die[] = state.dice.map((d) =>
    ids.has(d.id) ? { ...d, value: rollD6(deps.random), selected: false, origin: 'reroll' } : d,
  );
  return { ...state, dice, rememberedValues: [], selectedGroups: null };
}

function move(state: GameState, targetValue: number): GameState {
  const selected = state.dice.filter((d) => d.selected);
  if (selected.length === 0) return state;
  const ids = new Set(selected.map((d) => d.id));
  const dice: Die[] = state.dice.map((d) =>
    ids.has(d.id) ? { ...d, value: targetValue, selected: false, origin: 'move' } : d,
  );
  return { ...state, dice, selectedGroups: null };
}

function select(state: GameState, ids: string[], mode: SelectMode): GameState {
  const idSet = new Set(ids);
  const dice: Die[] = state.dice.map((d) => {
    if (mode === 'set') {
      const selected = idSet.has(d.id);
      return d.selected === selected ? d : { ...d, selected };
    }
    if (!idSet.has(d.id)) return d;
    if (mode === 'toggle') return { ...d, selected: !d.selected };
    if (mode === 'add') return d.selected ? d : { ...d, selected: true };
    return d.selected ? { ...d, selected: false } : d;
  });
  return { ...state, dice, selectedGroups: null };
}

function selectGroupRange(state: GameState, min: number, max: number): GameState {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const groups = state.selectedGroups;
  let changed = !(groups && groups.min === lo && groups.max === hi);
  const dice: Die[] = state.dice.map((d) => {
    const selected = d.value >= lo && d.value <= hi;
    if (d.selected !== selected) changed = true;
    return d.selected === selected ? d : { ...d, selected };
  });
  return changed ? { ...state, dice, selectedGroups: { min: lo, max: hi } } : state;
}

function clear(state: GameState): GameState {
  return { ...state, dice: [], swipeAddAvailable: true, rememberedValues: [], selectedGroups: null };
}
