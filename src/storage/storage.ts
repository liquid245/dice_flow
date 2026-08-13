import type { GameState } from '../core/game/state';
import { openDb, KV_STORE } from './db';

const GAME_KEY = 'game';

export interface GameStorage {
  loadGame(): Promise<GameState | null>;
  saveGame(state: GameState): Promise<void>;
}

export class Storage implements GameStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  async loadGame(): Promise<GameState | null> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction(KV_STORE, 'readonly').objectStore(KV_STORE).get(GAME_KEY);
      request.onsuccess = () => resolve((request.result as GameState | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveGame(state: GameState): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(KV_STORE, 'readwrite');
      transaction.objectStore(KV_STORE).put(state, GAME_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const storage = new Storage();
