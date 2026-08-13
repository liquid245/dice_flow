import type { GameState } from '../core/game/state';
import type { GameStorage } from './storage';

const SAVE_DEBOUNCE_MS = 500;

export interface PersistableEngine {
  getState(): GameState;
  subscribe(listener: () => void): () => void;
  restore(state: GameState): void;
}

export function initPersistence(engine: PersistableEngine, storage: GameStorage): () => void {
  void storage.loadGame().then((state) => {
    if (state) engine.restore(state);
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = engine.subscribe(() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void storage.saveGame(engine.getState());
    }, SAVE_DEBOUNCE_MS);
  });

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    unsubscribe();
  };
}
