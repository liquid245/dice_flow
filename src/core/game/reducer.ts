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
  const added: Die[] = [];
  for (let i = 0; i < count; i++) {
    added.push({
      id: deps.nextId(),
      type: 'd6',
      value: values && i < values.length ? values[i] : rollD6(deps.random),
      selected: false,
      origin: 'add',
    });
  }
  return { ...state, dice: [...state.dice, ...added], swipeAddAvailable: false };
}

function deleteDice(state: GameState, count: number | undefined): GameState {
  const selected = state.dice.filter((d) => d.selected);
  if (selected.length > 0) {
    const ids = new Set(selected.map((d) => d.id));
    return {
      ...state,
      dice: state.dice.filter((d) => !ids.has(d.id)),
      swipeAddAvailable: false,
    };
  }
  const n = Math.max(0, count ?? 1);
  if (n === 0 || state.dice.length === 0) return state;
  return {
    ...state,
    dice: state.dice.slice(0, state.dice.length - n),
    swipeAddAvailable: false,
  };
}

function roll(state: GameState, deps: EngineDeps): GameState {
  const selected = state.dice.filter((d) => d.selected);
  if (selected.length === 0) return state;
  const ids = new Set(selected.map((d) => d.id));
  const dice: Die[] = state.dice
    .filter((d) => ids.has(d.id))
    .map((d) => ({ ...d, value: rollD6(deps.random), selected: false, origin: 'roll' }));
  return { ...state, dice };
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
  return { ...state, dice };
}

function move(state: GameState, targetValue: number): GameState {
  const selected = state.dice.filter((d) => d.selected);
  if (selected.length === 0) return state;
  const ids = new Set(selected.map((d) => d.id));
  const dice: Die[] = state.dice.map((d) =>
    ids.has(d.id) ? { ...d, value: targetValue, selected: false, origin: 'move' } : d,
  );
  return { ...state, dice };
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
  return { ...state, dice };
}

function clear(state: GameState): GameState {
  return { ...state, dice: [], swipeAddAvailable: true };
}
