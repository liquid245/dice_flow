import { describe, it, expect } from 'vitest';
import type { Die } from '../core/dice/types';
import { TapCycleController, visualOrder } from './tapCycle';

function die(id: string, value: number): Die {
  return { id, type: 'd6', value, origin: 'add' };
}

function tap(
  ctl: TapCycleController,
  order: string[],
  id: string,
  selectedIds: string[],
) {
  return ctl.tap(order, id, new Set(selectedIds));
}

describe('visualOrder', () => {
  it('orders ids by value descending, stable within group', () => {
    const dice = [die('a', 2), die('b', 6), die('c', 2), die('d', 1), die('e', 6)];
    expect(visualOrder(dice)).toEqual(['b', 'e', 'a', 'c', 'd']);
  });
});

describe('TapCycleController', () => {
  const order = ['a', 'b', 'c', 'd'];

  it('first tap selects a single die', () => {
    const ctl = new TapCycleController();
    expect(tap(ctl, order, 'b', [])).toEqual({ type: 'select', ids: ['b'], mode: 'set' });
  });

  it('second tap on a different die selects the inclusive range', () => {
    const ctl = new TapCycleController();
    tap(ctl, order, 'b', []);
    expect(tap(ctl, order, 'd', ['b'])).toEqual({ type: 'select', ids: ['b', 'c', 'd'], mode: 'set' });
  });

  it('selects the range regardless of tap direction', () => {
    const ctl = new TapCycleController();
    tap(ctl, order, 'd', []);
    expect(tap(ctl, order, 'b', ['d'])).toEqual({ type: 'select', ids: ['b', 'c', 'd'], mode: 'set' });
  });

  it('tapping an already-selected die clears the selection', () => {
    const ctl = new TapCycleController();
    expect(tap(ctl, order, 'b', [])).toEqual({ type: 'select', ids: ['b'], mode: 'set' });
    expect(tap(ctl, order, 'b', ['b'])).toEqual({ type: 'select', ids: [], mode: 'set' });
  });

  it('tapping a selected die clears even from the range phase', () => {
    const ctl = new TapCycleController();
    tap(ctl, order, 'b', []);
    tap(ctl, order, 'd', ['b']);
    expect(tap(ctl, order, 'c', ['b', 'c', 'd'])).toEqual({ type: 'select', ids: [], mode: 'set' });
  });

  it('third tap on a non-selected die clears the selection', () => {
    const ctl = new TapCycleController();
    tap(ctl, order, 'b', []);
    tap(ctl, order, 'd', ['b']);
    expect(tap(ctl, order, 'a', ['b', 'c', 'd'])).toEqual({ type: 'select', ids: [], mode: 'set' });
  });

  it('swipe selects the inclusive range and enters the range phase', () => {
    const ctl = new TapCycleController();
    expect(ctl.swipe(order, 'a', 'c')).toEqual({ type: 'select', ids: ['a', 'b', 'c'], mode: 'set' });
    expect(tap(ctl, order, 'a', ['a', 'b', 'c'])).toEqual({ type: 'select', ids: [], mode: 'set' });
  });

  it('swipe selects the range regardless of direction', () => {
    const ctl = new TapCycleController();
    expect(ctl.swipe(order, 'c', 'a')).toEqual({ type: 'select', ids: ['a', 'b', 'c'], mode: 'set' });
  });

  it('reset returns to single-die selection', () => {
    const ctl = new TapCycleController();
    tap(ctl, order, 'b', []);
    tap(ctl, order, 'd', ['b']);
    ctl.reset();
    expect(tap(ctl, order, 'a', [])).toEqual({ type: 'select', ids: ['a'], mode: 'set' });
  });
});
