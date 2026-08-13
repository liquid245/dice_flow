import { useSyncExternalStore } from 'react';
import { createEngine } from '../core/game/engine';

export const engine = createEngine({
  random: Math.random,
  nextId: () => crypto.randomUUID(),
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
  };
}
