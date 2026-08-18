import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../core/game/state';
import { noneSelection } from '../core/selection/selection';
import { initPersistence, type PersistableEngine } from './persistence';
import type { GameStorage } from './storage';

function empty(): GameState {
  return { dice: [], history: [], swipeAddAvailable: true, rememberedValues: [], selection: noneSelection };
}

function fakeEngine(initial: GameState): PersistableEngine & { emit(): void; setState(state: GameState): void } {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore(state) {
      current = state;
    },
    emit() {
      for (const listener of listeners) listener();
    },
    setState(state) {
      current = state;
    },
  };
}

function fakeStorage(loaded: GameState | null) {
  return {
    loadGame: vi.fn(async () => loaded),
    saveGame: vi.fn(async () => undefined),
  } satisfies GameStorage & { loadGame: ReturnType<typeof vi.fn>; saveGame: ReturnType<typeof vi.fn> };
}

describe('initPersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores the saved state on init', async () => {
    const saved = { dice: [], history: [], swipeAddAvailable: false, rememberedValues: [], selection: noneSelection };
    const engine = fakeEngine(empty());
    const storage = fakeStorage(saved);

    initPersistence(engine, storage);
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(engine.getState().swipeAddAvailable).toBe(false);
  });

  it('does not overwrite a change made before loading completes', async () => {
    let resolveLoad: (state: GameState | null) => void;
    const storage = {
      loadGame: vi.fn(
        () =>
          new Promise<GameState | null>((resolve) => {
            resolveLoad = resolve;
          }),
      ),
      saveGame: vi.fn(async () => undefined),
    } satisfies GameStorage;
    const engine = fakeEngine(empty());

    initPersistence(engine, storage);
    const changed = { ...empty(), swipeAddAvailable: false };
    engine.setState(changed);
    engine.emit();
    resolveLoad!({ ...empty(), swipeAddAvailable: true });
    await Promise.resolve();

    expect(engine.getState()).toBe(changed);
  });

  it('saves state after a debounce following a change', () => {
    const engine = fakeEngine(empty());
    const storage = fakeStorage(null);

    initPersistence(engine, storage);
    engine.emit();
    engine.emit();
    expect(storage.saveGame).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(storage.saveGame).toHaveBeenCalledTimes(1);
    expect(storage.saveGame).toHaveBeenCalledWith(engine.getState());
  });

  it('stops saving after unsubscribe', () => {
    const engine = fakeEngine(empty());
    const storage = fakeStorage(null);

    const unsubscribe = initPersistence(engine, storage);
    unsubscribe();
    engine.emit();
    vi.advanceTimersByTime(500);
    expect(storage.saveGame).not.toHaveBeenCalled();
  });

  it('flushes a pending save when the document becomes hidden', () => {
    const engine = fakeEngine(empty());
    const storage = fakeStorage(null);

    const listeners: Record<string, () => void> = {};
    const documentStub = {
      visibilityState: 'visible',
      addEventListener: (event: string, fn: () => void) => {
        listeners[event] = fn;
      },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('document', documentStub);
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    initPersistence(engine, storage);
    engine.emit();
    documentStub.visibilityState = 'hidden';
    listeners.visibilitychange();

    expect(storage.saveGame).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
