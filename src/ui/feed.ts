import { config } from '../config';
import type { Die } from '../core/dice/types';
import type { HistoryEntry } from '../core/history/types';
import type { Selection } from '../core/selection/selection';
import { isDieSelected } from '../core/selection/selection';

const uiHistory = config.ui.history;

export function currentIteration(history: HistoryEntry[]): HistoryEntry[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const kind = history[i].kind;
    if (kind === 'roll' || kind === 'clear') return history.slice(i);
  }
  return history.slice();
}

export interface SelectedSummary {
  count: number;
  valueText: string;
}

export function describeSelection(dice: Die[], selection: Selection): SelectedSummary | null {
  const selectedValues = dice.filter((d) => isDieSelected(d, selection)).map((d) => d.value);
  if (selectedValues.length === 0) return null;
  const unique = Array.from(new Set(selectedValues)).sort((a, b) => a - b);
  const contiguous = unique.every((value, i) => i === 0 || value === unique[i - 1] + 1);
  let valueText: string;
  if (unique.length === 1) {
    valueText = `${unique[0]}${uiHistory.pluralSuffix}`;
  } else if (contiguous && unique[unique.length - 1] === 6) {
    valueText = `${unique[0]}+`;
  } else if (contiguous) {
    valueText = `${unique[0]}-${unique[unique.length - 1]}`;
  } else {
    valueText = unique.join(uiHistory.listSep);
  }
  return { count: selectedValues.length, valueText };
}

export function formatSelectionText(summary: SelectedSummary): string {
  return `${uiHistory.selectWord} ${summary.count} (${summary.valueText})`;
}

export function formatAction(entry: HistoryEntry): string {
  const verb = uiHistory.verbs[entry.kind] ?? entry.kind;
  switch (entry.kind) {
    case 'roll':
    case 'clear':
      return verb;
    case 'reroll':
      if (entry.count > 0 && entry.value !== undefined) {
        return `${verb} ${entry.count} ${entry.value}${uiHistory.pluralSuffix}`;
      }
      return entry.count > 0 ? `${verb} ${entry.count}` : verb;
    case 'move':
      return entry.count > 0 && entry.value !== undefined
        ? `${verb} ${entry.count} ${uiHistory.arrow} ${entry.value}`
        : verb;
    default:
      return entry.count > 0 ? `${verb} ${entry.count}` : verb;
  }
}
