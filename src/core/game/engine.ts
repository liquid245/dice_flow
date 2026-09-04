import type { Action, GameAction, LoggableAction } from '../actions/types';
import type { HistoryEntry } from '../history/types';
import type { GameState } from './state';
import { createInitialState, normalizeState } from './state';
import type { EngineDeps } from './deps';
import { reduce } from './reducer';
import type { Die } from '../dice/types';
import { selectedDice } from '../selection/selection';

export interface GameEngine {
  getState(): GameState;
  dispatch(action: Action): void;
  subscribe(listener: () => void): () => void;
  canUndo(): boolean;
  canRedo(): boolean;
  beginTransaction(): void;
  endTransaction(): void;
  restore(state: GameState): void;
  random(): number;
}

export function createEngine(deps: EngineDeps, initial: GameState = createInitialState()): GameEngine {
  let state = initial;
  const undoStack: GameState[] = [];
  let redoStack: GameState[] = [];
  const listeners = new Set<() => void>();
  let lastAction: string | null = null;
  let inTransaction = false;
  let transactionPushed = false;

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function dispatchGame(action: GameAction): void {
    if (action.type === 'select' || action.type === 'selectGroups') {
      state = reduce(state, action, deps);
      lastAction = null;
      notify();
      return;
    }

    const isMod = action.type === 'add' || action.type === 'delete';
    const coalesce = isMod && (lastAction === 'add' || lastAction === 'delete');

    if (inTransaction) {
      if (!transactionPushed) {
        undoStack.push(state);
        redoStack = [];
        transactionPushed = true;
      }
    } else if (!coalesce) {
      undoStack.push(state);
      redoStack = [];
    }

    const previous = state;
    state = reduce(state, action, deps);
    const entry = makeEntry(action, previous, state, deps);
    state = isMod ? mergeModEntry(state, entry) : appendEntry(state, entry);

    lastAction = action.type;
    notify();
  }

  function dispatch(action: Action): void {
    if (action.type === 'undo') {
      const previous = undoStack.pop();
      if (!previous) return;
      redoStack.push(state);
      state = previous;
      lastAction = null;
      notify();
      return;
    }
    if (action.type === 'redo') {
      const next = redoStack.pop();
      if (!next) return;
      undoStack.push(state);
      state = next;
      lastAction = null;
      notify();
      return;
    }
    dispatchGame(action);
  }

  return {
    getState: () => state,
    dispatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    beginTransaction() {
      inTransaction = true;
      transactionPushed = false;
      lastAction = null;
    },
    endTransaction() {
      inTransaction = false;
      transactionPushed = false;
      lastAction = null;
    },
    restore(restored: GameState) {
      state = normalizeState(restored);
      undoStack.length = 0;
      redoStack = [];
      lastAction = null;
      notify();
    },
    random: () => deps.random(),
  };
}

function valueTotals(dice: Die[], values: number[]): Record<number, number> {
  const table = new Map<number, number>();
  for (const d of dice) table.set(d.value, (table.get(d.value) ?? 0) + 1);
  const totals: Record<number, number> = {};
  for (const value of new Set(values)) {
    const total = table.get(value);
    if (total !== undefined) totals[value] = total;
  }
  return totals;
}

function makeEntry(
  action: LoggableAction,
  previous: GameState,
  next: GameState,
  deps: EngineDeps,
): HistoryEntry {
  const base = { id: deps.nextId(), timestamp: deps.now() };
  switch (action.type) {
    case 'roll': {
      const affected = selectedDice(previous.dice, previous.selection);
      if (affected.length === 0) return { ...base, kind: 'roll', count: 0 };
      const ids = new Set(affected.map((d) => d.id));
      const before = affected.map((d) => d.value);
      return {
        ...base,
        kind: 'roll',
        count: affected.length,
        before,
        totals: valueTotals(previous.dice, before),
        after: next.dice.filter((d) => ids.has(d.id)).map((d) => d.value),
      };
    }
    case 'reroll': {
      const selected = selectedDice(previous.dice, previous.selection);
      const targets = selected.length > 0 ? selected : previous.dice;
      if (targets.length === 0) return { ...base, kind: 'reroll', count: 0, before: [], after: [] };
      const ids = new Set(targets.map((d) => d.id));
      const before = targets.map((d) => d.value);
      const values = new Set(before);
      return {
        ...base,
        kind: 'reroll',
        count: targets.length,
        value: values.size === 1 ? targets[0].value : undefined,
        before,
        totals: valueTotals(previous.dice, before),
        after: next.dice.filter((d) => ids.has(d.id)).map((d) => d.value),
      };
    }
    case 'add':
      return {
        ...base,
        kind: 'add',
        count: action.count,
        after: next.dice.slice(previous.dice.length).map((d) => d.value),
      };
    case 'delete': {
      const selected = selectedDice(previous.dice, previous.selection);
      const removed =
        selected.length > 0
          ? selected
          : previous.dice.slice(-Math.min(Math.max(0, action.count ?? 1), previous.dice.length));
      const before = removed.map((d) => d.value);
      return {
        ...base,
        kind: 'delete',
        count: removed.length,
        before,
        totals: valueTotals(previous.dice, before),
      };
    }
    case 'move': {
      const affected = selectedDice(previous.dice, previous.selection);
      const before = affected.map((d) => d.value);
      return {
        ...base,
        kind: 'move',
        count: affected.length,
        value: action.targetValue,
        before,
        totals: valueTotals(previous.dice, before),
      };
    }
    case 'clear':
      return { ...base, kind: 'clear', count: previous.dice.length };
  }
}

function appendEntry(state: GameState, entry: HistoryEntry): GameState {
  return { ...state, history: [...state.history, entry] };
}

function mergeModEntry(state: GameState, entry: HistoryEntry): GameState {
  const history = state.history;
  const last = history[history.length - 1];
  if (!last || (last.kind !== 'add' && last.kind !== 'delete')) {
    return appendEntry(state, entry);
  }
  const lastNet = last.kind === 'add' ? last.count : -last.count;
  const entryNet = entry.kind === 'add' ? entry.count : -entry.count;
  const net = lastNet + entryNet;
  if (net === 0) {
    return { ...state, history: history.slice(0, -1) };
  }
  const merged: HistoryEntry = {
    id: last.id,
    timestamp: last.timestamp,
    kind: net > 0 ? 'add' : 'delete',
    count: Math.abs(net),
  };
  return { ...state, history: [...history.slice(0, -1), merged] };
}
