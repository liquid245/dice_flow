import type { Die } from '../dice/types';

export function groupByValue(dice: Die[]): Map<number, Die[]> {
  const groups = new Map<number, Die[]>();
  for (const d of dice) {
    const group = groups.get(d.value);
    if (group) {
      group.push(d);
    } else {
      groups.set(d.value, [d]);
    }
  }
  return groups;
}

export function countsByValue(dice: Die[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const d of dice) {
    counts.set(d.value, (counts.get(d.value) ?? 0) + 1);
  }
  return counts;
}
