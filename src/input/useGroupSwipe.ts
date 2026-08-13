import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { InputEngine } from './engine';
import { exceedsThreshold } from './dragMove';
import { selectRangeGroups } from './groupSwipe';
import { targetValueAt } from './dom';

interface GroupSwipeState {
  startValue: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

export function useGroupSwipe(engine: InputEngine) {
  const state = useRef<GroupSwipeState | null>(null);

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'mouse') return;
    const target = event.target as HTMLElement;
    if (target.closest?.('.die')) return;
    const group = target.closest?.('.group');
    if (!group) return;
    const value = Number(group.getAttribute('data-value'));
    if (Number.isNaN(value)) return;
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
  }

  function up(event: ReactPointerEvent<HTMLDivElement>) {
    const s = state.current;
    if (!s) return;
    state.current = null;
    if (!s.dragging) return;
    const endValue = targetValueAt(event.clientX, event.clientY);
    if (endValue === undefined) return;
    engine.dispatch(selectRangeGroups(engine.getState().dice, s.startValue, endValue));
  }

  function cancel() {
    state.current = null;
  }

  return {
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: up,
    onPointerCancel: cancel,
  };
}
