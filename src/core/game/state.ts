import { isD6Value, type Die } from '../dice/types';
import type { HistoryEntry } from '../history/types';
import type { Selection } from '../selection/selection';
import { noneSelection } from '../selection/selection';

export interface GameState {
  dice: Die[];
  history: HistoryEntry[];
  selection: Selection;
}

export function createInitialState(): GameState {
  return {
    dice: [],
    history: [],
    selection: noneSelection,
  };
}

interface LegacyDie extends Die {
  selected?: boolean;
}

interface LegacyState {
  dice?: LegacyDie[];
  history?: HistoryEntry[];
  selectedGroups?: { min: number; max: number } | null;
}

export function normalizeState(raw: GameState | LegacyState): GameState {
  const legacy = raw as LegacyState;
  const legacyDice = legacy.dice ?? [];
  let selection: Selection;
  if (legacy.selectedGroups) {
    selection = { kind: 'range', min: legacy.selectedGroups.min, max: legacy.selectedGroups.max };
  } else {
    const ids = new Set<string>();
    for (const die of legacyDice) {
      if (die.selected) ids.add(die.id);
    }
    selection = ids.size > 0 ? { kind: 'ids', ids } : noneSelection;
  }
  return {
    ...createInitialState(),
    dice: legacyDice.filter((die) => isD6Value(die.value)).map((die) => ({
      id: die.id,
      type: die.type,
      value: die.value,
      origin: die.origin,
      rev: die.rev,
    })),
    history: legacy.history ?? [],
    selection: 'selection' in raw && raw.selection && typeof (raw.selection as Selection).kind === 'string'
      ? (raw.selection as Selection)
      : selection,
  };
}
