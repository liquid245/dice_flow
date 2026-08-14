import type { HistoryEntry } from './types';

export function changesSinceLastRoll(history: HistoryEntry[]): HistoryEntry[] {
  let start = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const kind = history[i].kind;
    if (kind === 'roll' || kind === 'clear') {
      start = i + 1;
      break;
    }
  }
  return history.slice(start);
}
