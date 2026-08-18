import type { GameState } from '../core/game/state';
import type { GameStorage } from './storage';
import { config } from '../config';

export interface PersistableEngine {
  getState(): GameState;
  subscribe(listener: () => void): () => void;
  restore(state: GameState): void;
}

export function initPersistence(engine: PersistableEngine, storage: GameStorage): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let changedBeforeRestore = false;
  let restoring = false;

  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    void storage.saveGame(engine.getState());
  };

  const unsubscribe = engine.subscribe(() => {
    if (restoring) return;
    changedBeforeRestore = true;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(flush, config.storage.saveDebounceMs);
  });

  void storage.loadGame().then((state) => {
    if (!state || changedBeforeRestore) return;
    restoring = true;
    try {
      engine.restore(state);
    } finally {
      restoring = false;
    }
  });

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibilityChange);
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    unsubscribe();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibilityChange);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', flush);
  };
}
