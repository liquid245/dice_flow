import type { DiceId, Die } from '../dice/types';

export type Selection =
  | { kind: 'none' }
  | { kind: 'ids'; ids: ReadonlySet<DiceId> }
  | { kind: 'range'; min: number; max: number };

export const noneSelection: Selection = { kind: 'none' };

export function hasSelection(selection: Selection): boolean {
  return selection.kind !== 'none';
}

export function isDieSelected(die: Die, selection: Selection): boolean {
  switch (selection.kind) {
    case 'ids':
      return selection.ids.has(die.id);
    case 'range':
      return die.value >= selection.min && die.value <= selection.max;
    default:
      return false;
  }
}

export function selectedDice(dice: Die[], selection: Selection): Die[] {
  return dice.filter((d) => isDieSelected(d, selection));
}

export function selectedIds(dice: Die[], selection: Selection): Set<DiceId> {
  const ids = new Set<DiceId>();
  for (const die of dice) {
    if (isDieSelected(die, selection)) ids.add(die.id);
  }
  return ids;
}
