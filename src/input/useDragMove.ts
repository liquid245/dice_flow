import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { InputEngine } from './engine';
import { exceedsThreshold, moveTarget } from './dragMove';
import { targetValueAt } from './dom';

interface DragState {
  dieId: string;
  startValue: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

export function useDragMove(engine: InputEngine) {
  const drag = useRef<DragState | null>(null);

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'mouse') return;
    const target = event.target as HTMLElement;
    const die = target.closest?.('.die');
    if (!die) return;
    const dieId = die.getAttribute('data-die-id');
    const startValue = Number(die.getAttribute('data-die-value'));
    if (!dieId || Number.isNaN(startValue)) return;
    drag.current = {
      dieId,
      startValue,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    if (!d.dragging && !exceedsThreshold(d.startX, d.startY, event.clientX, event.clientY)) return;
    if (!d.dragging) {
      d.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function up(event: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (!d.dragging) return;

    const target = targetValueAt(event.clientX, event.clientY);
    engine.beginTransaction();
    engine.dispatch({ type: 'select', ids: [d.dieId], mode: 'add' });
    const selectedCount = engine.getState().dice.filter((x) => x.selected).length;
    const action = moveTarget(d.startValue, selectedCount, target);
    if (action) engine.dispatch(action);
    engine.endTransaction();
  }

  function cancel() {
    drag.current = null;
  }

  return {
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: up,
    onPointerCancel: cancel,
  };
}
