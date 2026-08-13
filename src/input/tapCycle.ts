import type { DiceId, Die } from '../core/dice/types';
import type { GameAction } from '../core/actions/types';

export function visualOrder(dice: Die[]): DiceId[] {
  const ids: DiceId[] = [];
  for (let value = 6; value >= 1; value--) {
    for (const die of dice) {
      if (die.value === value) ids.push(die.id);
    }
  }
  return ids;
}

type TapPhase = 'idle' | 'single' | 'range';

export class TapCycleController {
  private phase: TapPhase = 'idle';
  private anchorId: DiceId | null = null;

  tap(order: DiceId[], tappedId: DiceId): GameAction {
    if (this.phase === 'idle') {
      this.phase = 'single';
      this.anchorId = tappedId;
      return { type: 'select', ids: [tappedId], mode: 'set' };
    }

    if (this.phase === 'single') {
      this.phase = 'range';
      return {
        type: 'select',
        ids: sliceRange(order, this.anchorId ?? tappedId, tappedId),
        mode: 'set',
      };
    }

    this.phase = 'idle';
    this.anchorId = null;
    return { type: 'select', ids: [], mode: 'set' };
  }

  reset(): void {
    this.phase = 'idle';
    this.anchorId = null;
  }
}

function sliceRange(order: DiceId[], a: DiceId, b: DiceId): DiceId[] {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return [b];
  const start = Math.min(ia, ib);
  const end = Math.max(ia, ib);
  return order.slice(start, end + 1);
}
