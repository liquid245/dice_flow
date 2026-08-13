import type { GameState } from '../core/game/state';
import type { GameStorage } from './storage';

const SAVE_DEBOUNCE_MS = 500;

export interface PersistableEngine {
  getState(): GameState;
  subscribe(listener: () => void): () => void;
  restore(state: GameState): void;
}

export function initPersistence(engine: PersistableEngine, storage: GameStorage): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    void storage.saveGame(engine.getState());
  };

  void storage.loadGame().then((state) => {
    if (state) engine.restore(state);
  });

  const unsubscribe = engine.subscribe(() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
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
