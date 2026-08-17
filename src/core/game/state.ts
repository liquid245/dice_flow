import type { Die } from '../dice/types';
import type { HistoryEntry } from '../history/types';
import type { Selection } from '../selection/selection';
import { noneSelection } from '../selection/selection';

export interface GameState {
  dice: Die[];
  history: HistoryEntry[];
  swipeAddAvailable: boolean;
  rememberedValues: number[];
  selection: Selection;
}

export function createInitialState(): GameState {
  return {
    dice: [],
    history: [],
    swipeAddAvailable: true,
    rememberedValues: [],
    selection: noneSelection,
  };
}

interface LegacyDie extends Die {
  selected?: boolean;
}

interface LegacyState {
  dice?: LegacyDie[];
  history?: HistoryEntry[];
  swipeAddAvailable?: boolean;
  rememberedValues?: number[];
  selectedGroups?: { min: number; max: number } | null;
}

export function normalizeState(raw: GameState | LegacyState): GameState {
  if ('selection' in raw && raw.selection && typeof (raw.selection as Selection).kind === 'string') {
    return { ...createInitialState(), ...(raw as GameState) };
  }
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
    dice: legacyDice.map((die) => ({
      id: die.id,
      type: die.type,
      value: die.value,
      origin: die.origin,
    })),
    history: legacy.history ?? [],
    swipeAddAvailable: legacy.swipeAddAvailable ?? true,
    rememberedValues: legacy.rememberedValues ?? [],
    selection,
  };
}
