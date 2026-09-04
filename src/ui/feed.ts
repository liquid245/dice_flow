import { config } from '../config';
import type { Die } from '../core/dice/types';
import type { HistoryEntry } from '../core/history/types';
import { currentChunk } from '../core/history/selectors';
import type { Selection } from '../core/selection/selection';
import { isDieSelected } from '../core/selection/selection';

const uiHistory = config.ui.history;

function valueTextFor(values: number[]): string {
  const unique = Array.from(new Set(values)).sort((a, b) => a - b);
  if (unique.length === 0) return '';
  const contiguous = unique.every((value, i) => i === 0 || value === unique[i - 1] + 1);
  if (contiguous) {
    const first = unique[0];
    const last = unique[unique.length - 1];
    if (last === 6) return `${first}+`;
    if (first === last) return `${first}${uiHistory.pluralSuffix}`;
    return `${first}-${last}`;
  }
  return unique.join(uiHistory.listSep);
}

export interface SelectedSummary {
  count: number;
  valueText: string;
}

export function describeSelection(dice: Die[], selection: Selection): SelectedSummary | null {
  const selectedValues = dice.filter((d) => isDieSelected(d, selection)).map((d) => d.value);
  if (selectedValues.length === 0) return null;
  return { count: selectedValues.length, valueText: valueTextFor(selectedValues) };
}

export function formatSelectionText(summary: SelectedSummary): string {
  return `${uiHistory.selectWord} ${summary.count} (${summary.valueText})`;
}

function formatGrouped(values: number[]): string {
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const value of Array.from(counts.keys()).sort((a, b) => b - a)) {
    const count = counts.get(value) as number;
    parts.push(count > 1 ? `${value}×${count}` : `${value}`);
  }
  return parts.join(uiHistory.listSep);
}

export function formatAction(entry: HistoryEntry): string {
  const verb = uiHistory.verbs[entry.kind] ?? entry.kind;
  switch (entry.kind) {
    case 'roll':
      return entry.after && entry.after.length > 0
        ? `${verb} ${entry.after.length} ${uiHistory.arrow} ${formatGrouped(entry.after)}`
        : verb;
    case 'clear':
      return verb;
    case 'reroll': {
      const before = entry.before && entry.before.length > 0 ? valueTextFor(entry.before) : '';
      if (entry.after && entry.after.length > 0) {
        return before
          ? `${verb} ${entry.after.length} ${before} ${uiHistory.arrow} ${formatGrouped(entry.after)}`
          : `${verb} ${entry.after.length} ${uiHistory.arrow} ${formatGrouped(entry.after)}`;
      }
      if (entry.count > 0 && entry.value !== undefined) {
        return `${verb} ${entry.count} ${valueTextFor([entry.value])}`;
      }
      return entry.count > 0 ? `${verb} ${entry.count}` : verb;
    }
    case 'move':
      return entry.count > 0 && entry.value !== undefined
        ? `${verb} ${entry.count} ${uiHistory.arrow} ${entry.value}`
        : verb;
    default:
      return entry.count > 0 ? `${verb} ${entry.count}` : verb;
  }
}

function lastRollRerollIndex(chunk: HistoryEntry[]): number {
  for (let i = chunk.length - 1; i >= 0; i--) {
    if (chunk[i].kind === 'roll' || chunk[i].kind === 'reroll') return i;
  }
  return -1;
}

export interface HistoryFeed {
  chunk: HistoryEntry[];
  system: string | null;
  summary: string;
  rows: string[];
  active: boolean;
}

export function buildHistoryFeed(dice: Die[], history: HistoryEntry[], swipeHint: string): HistoryFeed {
  const chunk = currentChunk(history);
  if (dice.length === 0) {
    return { chunk, system: swipeHint, summary: '', rows: [], active: false };
  }
  const rows = chunk.map((entry) => formatAction(entry));
  const total = `${dice.length} ${uiHistory.diceWord}`;
  if (rows.length === 0) {
    return { chunk, system: null, summary: total, rows, active: false };
  }
  const rollIndex = lastRollRerollIndex(chunk);
  const index = rollIndex >= 0 ? rollIndex : chunk.length - 1;
  const summary = `${rows[index]}${uiHistory.segmentSep}${total}`;
  return { chunk, system: null, summary, rows, active: chunk.length > 1 };
}
