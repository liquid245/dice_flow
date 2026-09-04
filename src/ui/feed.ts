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

function groupLabel(values: number[], totals?: Record<number, number>): string {
  if (totals) {
    const counts = new Map<number, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const partial = Array.from(counts.keys()).some(
      (value) => (counts.get(value) ?? 0) < (totals[value] ?? 0),
    );
    if (partial) {
      const unique = Array.from(counts.keys()).sort((a, b) => a - b);
      const lo = unique[0];
      const hi = unique[unique.length - 1];
      return lo === hi ? `${uiHistory.someWord} ${lo}` : `${uiHistory.someWord} ${lo}-${hi}`;
    }
  }
  return valueTextFor(values);
}

export function describeSelection(dice: Die[], selection: Selection): SelectedSummary | null {
  const selectedDice = dice.filter((d) => isDieSelected(d, selection));
  if (selectedDice.length === 0) return null;
  let valueText: string;
  if (selection.kind === 'range') {
    const groups: number[] = [];
    for (let value = selection.min; value <= selection.max; value++) groups.push(value);
    valueText = valueTextFor(groups);
  } else {
    const totals: Record<number, number> = {};
    for (const d of dice) totals[d.value] = (totals[d.value] ?? 0) + 1;
    valueText = groupLabel(
      selectedDice.map((d) => d.value),
      totals,
    );
  }
  return { count: selectedDice.length, valueText };
}

export function formatSelectionText(summary: SelectedSummary): string {
  return `${uiHistory.selectWord} ${summary.count} (${summary.valueText})`;
}

function formatLiveAction(entry: HistoryEntry): string {
  const verb = uiHistory.verbs[entry.kind] ?? entry.kind;
  if (entry.kind === 'clear') return verb;
  return entry.count > 0 ? `${verb} ${entry.count}` : verb;
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
  const before = entry.before && entry.before.length > 0 ? entry.before : undefined;
  const after = entry.after && entry.after.length > 0 ? entry.after : undefined;
  switch (entry.kind) {
    case 'roll':
      if (before && after) {
        return `${verb} ${entry.count} ${groupLabel(before, entry.totals)} ${uiHistory.arrow} ${formatGrouped(after)}`;
      }
      if (after) return `${verb} ${after.length} ${uiHistory.arrow} ${formatGrouped(after)}`;
      return verb;
    case 'reroll': {
      if (before && after) {
        return `${verb} ${entry.count} ${groupLabel(before, entry.totals)} ${uiHistory.arrow} ${formatGrouped(after)}`;
      }
      if (after) return `${verb} ${entry.count} ${uiHistory.arrow} ${formatGrouped(after)}`;
      if (entry.count > 0 && entry.value !== undefined) {
        return `${verb} ${entry.count} ${valueTextFor([entry.value])}`;
      }
      return entry.count > 0 ? `${verb} ${entry.count}` : verb;
    }
    case 'move':
      if (before && entry.count > 0 && entry.value !== undefined) {
        return `${verb} ${entry.count} ${groupLabel(before, entry.totals)} ${uiHistory.arrow} ${entry.value}`;
      }
      return entry.count > 0 && entry.value !== undefined
        ? `${verb} ${entry.count} ${uiHistory.arrow} ${entry.value}`
        : verb;
    case 'delete':
      if (before) return `${verb} ${entry.count} ${groupLabel(before, entry.totals)}`;
      return entry.count > 0 ? `${verb} ${entry.count}` : verb;
    case 'add':
      if (after && entry.count === after.length) {
        return `${verb} ${entry.count} ${uiHistory.arrow} ${formatGrouped(after)}`;
      }
      return entry.count > 0 ? `${verb} ${entry.count}` : verb;
    case 'clear':
      return verb;
    default:
      return entry.count > 0 ? `${verb} ${entry.count}` : verb;
  }
}

export interface HistoryFeed {
  chunk: HistoryEntry[];
  system: string | null;
  summary: string;
  rows: string[];
  active: boolean;
}

export function buildHistoryFeed(
  dice: Die[],
  selection: Selection,
  history: HistoryEntry[],
  swipeHint: string,
): HistoryFeed {
  const chunk = currentChunk(history);
  if (dice.length === 0) {
    return { chunk, system: swipeHint, summary: '', rows: [], active: false };
  }
  const rows = chunk.slice(0, -1).map((entry) => formatAction(entry));
  const parts: string[] = [];
  const last = chunk[chunk.length - 1];
  if (last) parts.push(formatLiveAction(last));
  parts.push(`${uiHistory.totalWord} ${dice.length}`);
  const selected = describeSelection(dice, selection);
  if (selected) parts.push(formatSelectionText(selected));
  const summary = parts.join(uiHistory.segmentSep);
  return { chunk, system: null, summary, rows, active: chunk.length > 1 };
}
