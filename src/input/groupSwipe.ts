import type { DiceId, Die } from '../core/dice/types';
import type { GameAction } from '../core/actions/types';

export function rangeGroupIds(dice: Die[], startValue: number, endValue: number): DiceId[] {
  const lo = Math.min(startValue, endValue);
  const hi = Math.max(startValue, endValue);
  return dice.filter((d) => d.value >= lo && d.value <= hi).map((d) => d.id);
}

export function selectRangeGroups(dice: Die[], startValue: number, endValue: number): GameAction {
  return { type: 'select', ids: rangeGroupIds(dice, startValue, endValue), mode: 'set' };
}
