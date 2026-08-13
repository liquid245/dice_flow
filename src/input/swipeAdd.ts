import type { GameAction } from '../core/actions/types';

export class SwipeAddSession {
  private count = 0;
  private values: number[] = [];

  constructor(private readonly roll: () => number) {}

  setCount(target: number): GameAction[] {
    const desired = Math.max(0, Math.floor(target));
    const actions: GameAction[] = [];

    if (desired > this.count) {
      while (this.values.length < desired) {
        this.values.push(this.roll());
      }
      actions.push({
        type: 'add',
        count: desired - this.count,
        values: this.values.slice(this.count, desired),
      });
    } else if (desired < this.count) {
      actions.push({ type: 'delete', count: this.count - desired });
    }

    this.count = desired;
    return actions;
  }
}
