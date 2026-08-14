import { describe, it, expect } from 'vitest';
import { DieGestureController } from './dieGesture';

describe('DieGestureController', () => {
  it('tap: down then up without movement', () => {
    const g = new DieGestureController();
    g.down();
    expect(g.up()).toBe('tap');
  });

  it('tap: movement within threshold then up', () => {
    const g = new DieGestureController();
    g.down();
    g.move(false);
    expect(g.up()).toBe('tap');
  });

  it('swipe: movement beyond threshold before the timer', () => {
    const g = new DieGestureController();
    g.down();
    g.move(true);
    expect(g.up()).toBe('swipe');
  });

  it('drag: timer expiry activates dragging before any movement', () => {
    const g = new DieGestureController();
    g.down();
    g.timerExpired();
    expect(g.isDragging()).toBe(true);
    g.move(false);
    expect(g.up()).toBe('drag');
  });

  it('drag: timer expiry during a swipe does not start a drag', () => {
    const g = new DieGestureController();
    g.down();
    g.move(true);
    g.timerExpired();
    expect(g.isDragging()).toBe(false);
    expect(g.isSwiping()).toBe(true);
    expect(g.up()).toBe('swipe');
  });

  it('up resets to idle for the next gesture', () => {
    const g = new DieGestureController();
    g.down();
    g.up();
    g.down();
    expect(g.up()).toBe('tap');
  });

  it('cancel resets to idle', () => {
    const g = new DieGestureController();
    g.down();
    g.move(true);
    g.cancel();
    expect(g.isDragging()).toBe(false);
    g.down();
    expect(g.up()).toBe('tap');
  });

  it('timer does not activate dragging after up', () => {
    const g = new DieGestureController();
    g.down();
    g.up();
    g.timerExpired();
    expect(g.up()).toBe('tap');
  });
});
