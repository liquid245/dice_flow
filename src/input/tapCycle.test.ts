import { describe, it, expect } from 'vitest';
import type { Die } from '../core/dice/types';
import { TapCycleController, visualOrder } from './tapCycle';

function die(id: string, value: number): Die {
  return { id, type: 'd6', value, selected: false, origin: 'add' };
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
    expect(ctl.tap(order, 'b')).toEqual({ type: 'select', ids: ['b'], mode: 'set' });
  });

  it('second tap selects the inclusive range', () => {
    const ctl = new TapCycleController();
    ctl.tap(order, 'b');
    expect(ctl.tap(order, 'd')).toEqual({ type: 'select', ids: ['b', 'c', 'd'], mode: 'set' });
  });

  it('selects the range regardless of tap direction', () => {
    const ctl = new TapCycleController();
    ctl.tap(order, 'd');
    expect(ctl.tap(order, 'b')).toEqual({ type: 'select', ids: ['b', 'c', 'd'], mode: 'set' });
  });

  it('third tap clears the selection', () => {
    const ctl = new TapCycleController();
    ctl.tap(order, 'b');
    ctl.tap(order, 'd');
    expect(ctl.tap(order, 'a')).toEqual({ type: 'select', ids: [], mode: 'set' });
  });

  it('tapping the same die three times cycles to clear', () => {
    const ctl = new TapCycleController();
    expect(ctl.tap(order, 'b')).toEqual({ type: 'select', ids: ['b'], mode: 'set' });
    expect(ctl.tap(order, 'b')).toEqual({ type: 'select', ids: ['b'], mode: 'set' });
    expect(ctl.tap(order, 'b')).toEqual({ type: 'select', ids: [], mode: 'set' });
  });

  it('reset returns to single-die selection', () => {
    const ctl = new TapCycleController();
    ctl.tap(order, 'b');
    ctl.tap(order, 'd');
    ctl.reset();
    expect(ctl.tap(order, 'a')).toEqual({ type: 'select', ids: ['a'], mode: 'set' });
  });
});
