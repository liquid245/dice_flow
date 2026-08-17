import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { InputEngine } from './engine';
import type { HitTest } from './hitTest';
import { exceedsThreshold } from './dragMove';
import { selectRangeGroups, sameGroupRange } from './groupSwipe';

interface GroupSwipeState {
  startValue: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

export function useGroupSwipe(engine: InputEngine, hitTest: HitTest) {
  const state = useRef<GroupSwipeState | null>(null);
  const lastRange = useRef<{ min: number; max: number } | null>(null);

  function dispatchRange(startValue: number, endValue: number) {
    const range = { min: Math.min(startValue, endValue), max: Math.max(startValue, endValue) };
    if (sameGroupRange(lastRange.current, startValue, endValue)) return;
    lastRange.current = range;
    engine.dispatch(selectRangeGroups(startValue, endValue));
  }

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'mouse') return;
    if (hitTest.dieAt(event.clientX, event.clientY)) return;
    const value = hitTest.groupAt(event.clientX, event.clientY);
    if (value === undefined) return;
    lastRange.current = null;
    state.current = {
      startValue: value,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const s = state.current;
    if (!s) return;
    if (!s.dragging && !exceedsThreshold(s.startX, s.startY, event.clientX, event.clientY)) return;
    if (!s.dragging) {
      s.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const endValue = hitTest.groupAt(event.clientX, event.clientY);
    if (endValue === undefined) return;
    dispatchRange(s.startValue, endValue);
  }

  function up(event: ReactPointerEvent<HTMLDivElement>) {
    const s = state.current;
    if (!s) return;
    state.current = null;
    lastRange.current = null;

    if (!s.dragging) {
      engine.dispatch(selectRangeGroups(s.startValue, s.startValue));
      return;
    }
    const endValue = hitTest.groupAt(event.clientX, event.clientY);
    if (endValue === undefined) return;
    engine.dispatch(selectRangeGroups(s.startValue, endValue));
  }

  function cancel() {
    state.current = null;
    lastRange.current = null;
  }

  return {
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: up,
    onPointerCancel: cancel,
  };
}
