import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { InputEngine } from './engine';
import type { HitTest } from './hitTest';
import { exceedsThreshold, moveTarget } from './dragMove';

interface DragState {
  dieId: string;
  startValue: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

export function useDragMove(engine: InputEngine, hitTest: HitTest, onTap: (dieId: string) => void) {
  const drag = useRef<DragState | null>(null);

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'mouse') return;
    const die = hitTest.dieAt(event.clientX, event.clientY);
    if (!die) return;
    drag.current = {
      dieId: die.id,
      startValue: die.value,
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
    if (!d.dragging) {
      onTap(d.dieId);
      return;
    }

    const target = hitTest.groupAt(event.clientX, event.clientY);
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
