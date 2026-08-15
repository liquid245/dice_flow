import type { Die } from '../dice/types';
import type { HistoryEntry } from '../history/types';

export interface GameState {
  dice: Die[];
  history: HistoryEntry[];
  swipeAddAvailable: boolean;
  rememberedValues: number[];
  selectedGroups: { min: number; max: number } | null;
}

export function createInitialState(): GameState {
  return {
    dice: [],
    history: [],
    swipeAddAvailable: true,
    rememberedValues: [],
    selectedGroups: null,
  };
}
