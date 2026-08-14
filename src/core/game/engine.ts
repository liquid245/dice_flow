import type { Action, GameAction } from '../actions/types';
import type { HistoryEntry } from '../history/types';
import type { GameState } from './state';
import { createInitialState } from './state';
import type { EngineDeps } from './deps';
import { reduce } from './reducer';

export interface GameEngine {
  getState(): GameState;
  dispatch(action: Action): void;
  subscribe(listener: () => void): () => void;
  canUndo(): boolean;
  canRedo(): boolean;
  beginTransaction(): void;
  endTransaction(): void;
  restore(state: GameState): void;
}

export function createEngine(deps: EngineDeps, initial: GameState = createInitialState()): GameEngine {
  let state = initial;
  const undoStack: GameState[] = [];
  let redoStack: GameState[] = [];
  const listeners = new Set<() => void>();
  let lastAction: string | null = null;
  let inTransaction = false;
  let transactionPushed = false;
  let transactionDirty = false;

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function dispatchGame(action: GameAction): void {
    if (action.type === 'select') {
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
      if (isMod) transactionDirty = true;
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
      transactionDirty = false;
      lastAction = null;
    },
    endTransaction() {
      inTransaction = false;
      transactionPushed = false;
      if (transactionDirty) {
        state = { ...state, rememberedValues: [] };
      }
      transactionDirty = false;
      lastAction = null;
    },
    restore(restored: GameState) {
      state = { ...createInitialState(), ...restored };
      undoStack.length = 0;
      redoStack = [];
      lastAction = null;
      notify();
    },
  };
}

function selectedCount(state: GameState): number {
  return state.dice.filter((d) => d.selected).length;
}

function makeEntry(action: GameAction, previous: GameState, next: GameState, deps: EngineDeps): HistoryEntry {
  const base = { id: deps.nextId(), timestamp: deps.now() };
  switch (action.type) {
    case 'roll':
      return { ...base, kind: 'roll', count: selectedCount(previous) };
    case 'reroll': {
      const selected = previous.dice.filter((d) => d.selected);
      const targets = selected.length > 0 ? selected : previous.dice;
      const values = new Set(targets.map((d) => d.value));
      return {
        ...base,
        kind: 'reroll',
        count: targets.length,
        value: values.size === 1 ? targets[0].value : undefined,
      };
    }
    case 'add':
      return { ...base, kind: 'add', count: action.count };
    case 'delete': {
      const selected = previous.dice.filter((d) => d.selected);
      const count =
        selected.length > 0 ? selected.length : Math.min(Math.max(0, action.count ?? 1), previous.dice.length);
      return { ...base, kind: 'delete', count };
    }
    case 'move':
      return { ...base, kind: 'move', count: selectedCount(previous), value: action.targetValue };
    case 'select':
      return { ...base, kind: 'select', count: selectedCount(next) };
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
  const merged: HistoryEntry = { ...last, kind: net > 0 ? 'add' : 'delete', count: Math.abs(net) };
  return { ...state, history: [...history.slice(0, -1), merged] };
}
