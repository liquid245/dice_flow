import { useSyncExternalStore } from 'react';
import { createEngine } from '../core/game/engine';

function nextId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const engine = createEngine({
  random: Math.random,
  nextId,
  now: () => Date.now(),
});

export function useGame() {
  const state = useSyncExternalStore(engine.subscribe, engine.getState);
  return {
    state,
    dispatch: engine.dispatch,
    canUndo: engine.canUndo,
    canRedo: engine.canRedo,
    beginTransaction: engine.beginTransaction,
    endTransaction: engine.endTransaction,
    getState: engine.getState,
    random: engine.random,
  };
}
