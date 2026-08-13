import type { Die } from '../dice/types';
import type { HistoryEntry } from '../history/types';

export interface GameState {
  dice: Die[];
  history: HistoryEntry[];
  swipeAddAvailable: boolean;
}

export function createInitialState(): GameState {
  return { dice: [], history: [], swipeAddAvailable: true };
}
