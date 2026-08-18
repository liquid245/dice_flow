import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { InputEngine } from './engine';
import type { HitTest } from './hitTest';
import { exceedsThreshold, moveTarget } from './dragMove';
import { DieGestureController } from './dieGesture';
import { isDieSelected, selectedDice } from '../core/selection/selection';
import { config } from '../config';

interface PressState {
  dieId: string;
  startValue: number;
  startX: number;
  startY: number;
  wasSelected: boolean;
}

export function useDragMove(
  engine: InputEngine,
  hitTest: HitTest,
  onTap: (dieId: string) => void,
  onSwipe?: (fromId: string, toId: string) => void,
  onSwipeEnd?: (fromId: string, toId: string | null) => void,
  onDrag?: (drag: { id: string; x: number; y: number; solo?: boolean; target?: number } | null) => void,
) {
  const gesture = useRef(new DieGestureController());
  const press = useRef<PressState | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const timer = useRef<number | null>(null);

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  useEffect(() => clearTimer, []);

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'mouse') return;
    const die = hitTest.dieAt(event.clientX, event.clientY);
    if (!die) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current.down();
    const gameDie = engine.getState().dice.find((x) => x.id === die.id);
    press.current = {
      dieId: die.id,
      startValue: die.value,
      startX: event.clientX,
      startY: event.clientY,
      wasSelected: gameDie ? isDieSelected(gameDie, engine.getState().selection) : false,
    };
    last.current = { x: event.clientX, y: event.clientY };
    clearTimer();
    timer.current = window.setTimeout(() => {
      gesture.current.timerExpired();
      const d = press.current;
      if (gesture.current.isDragging() && d) {
        if (!d.wasSelected) {
          engine.dispatch({ type: 'select', ids: [d.dieId], mode: 'set' });
        }
        onDrag?.({ id: d.dieId, x: last.current.x, y: last.current.y, solo: !d.wasSelected });
      }
    }, config.input.dragDelayMs);
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const d = press.current;
    if (!d) return;
    last.current = { x: event.clientX, y: event.clientY };
    gesture.current.move(exceedsThreshold(d.startX, d.startY, event.clientX, event.clientY));
    if (gesture.current.isDragging()) {
      onDrag?.({
        id: d.dieId,
        x: event.clientX,
        y: event.clientY,
        solo: !d.wasSelected,
        target: hitTest.groupAt(event.clientX, event.clientY),
      });
      return;
    }
    if (gesture.current.isSwiping()) {
      const hover = hitTest.dieAt(event.clientX, event.clientY);
      if (hover) onSwipe?.(d.dieId, hover.id);
    }
  }

  function up(event: ReactPointerEvent<HTMLDivElement>) {
    clearTimer();
    const d = press.current;
    if (!d) return;
    press.current = null;
    const outcome = gesture.current.up();
    if (outcome === 'tap') {
      onTap(d.dieId);
      return;
    }
    if (outcome === 'swipe') {
      const hover = hitTest.dieAt(event.clientX, event.clientY);
      onSwipeEnd?.(d.dieId, hover?.id ?? null);
      return;
    }
    const target = hitTest.groupAt(event.clientX, event.clientY);
    engine.beginTransaction();
    engine.dispatch({ type: 'select', ids: [d.dieId], mode: d.wasSelected ? 'add' : 'set' });
    const g = engine.getState();
    const selectedCount = selectedDice(g.dice, g.selection).length;
    const action = moveTarget(d.startValue, selectedCount, target);
    if (action) {
      engine.dispatch(action);
    } else {
      engine.dispatch({ type: 'select', ids: [], mode: 'set' });
    }
    engine.endTransaction();
    onDrag?.(null);
  }

  function cancel() {
    clearTimer();
    if (press.current && gesture.current.isDragging()) onDrag?.(null);
    gesture.current.cancel();
    press.current = null;
  }

  return {
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: up,
    onPointerCancel: cancel,
  };
}
