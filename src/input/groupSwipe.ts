import type { GameAction } from '../core/actions/types';

export function selectRangeGroups(startValue: number, endValue: number): GameAction {
  return {
    type: 'selectGroups',
    min: Math.min(startValue, endValue),
    max: Math.max(startValue, endValue),
  };
}

export function sameGroupRange(
  last: { min: number; max: number } | null,
  startValue: number,
  endValue: number,
): boolean {
  return !!last && last.min === Math.min(startValue, endValue) && last.max === Math.max(startValue, endValue);
}
