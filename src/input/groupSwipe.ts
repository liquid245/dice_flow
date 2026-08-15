import type { GameAction } from '../core/actions/types';

export function selectRangeGroups(startValue: number, endValue: number): GameAction {
  return {
    type: 'selectGroups',
    min: Math.min(startValue, endValue),
    max: Math.max(startValue, endValue),
  };
}
