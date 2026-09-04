import type { HistoryEntry } from './types';

export function currentChunk(history: HistoryEntry[]): HistoryEntry[] {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].kind === 'clear') return history.slice(i + 1);
  }
  return history.slice();
}
