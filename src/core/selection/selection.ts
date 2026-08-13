import type { Die } from '../dice/types';

export function selectedDice(dice: Die[]): Die[] {
  return dice.filter((d) => d.selected);
}
