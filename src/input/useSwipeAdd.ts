import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { rollD6 } from '../core/dice/roll';
import { SwipeAddSession } from './swipeAdd';
import type { InputEngine } from './engine';
import { config } from '../config';

interface Gesture {
  session: SwipeAddSession;
  startX: number;
  active: boolean;
}

export function useSwipeAdd(engine: InputEngine, enabled: () => boolean) {
  const gesture = useRef<Gesture | null>(null);

  function begin(event: ReactPointerEvent<HTMLDivElement>) {
    if (!enabled()) return;
    if (event.pointerType !== 'touch' && event.pointerType !== 'mouse') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    engine.beginTransaction();
    gesture.current = {
      session: new SwipeAddSession(() => rollD6(Math.random)),
      startX: event.clientX,
      active: true,
    };
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || !g.active) return;
    const target = Math.round((event.clientX - g.startX) / config.input.pixelsPerDie);
    for (const action of g.session.setCount(target)) {
      engine.dispatch(action);
    }
  }

  function end() {
    const g = gesture.current;
    if (!g) return;
    g.active = false;
    gesture.current = null;
    engine.endTransaction();
  }

  return {
    onPointerDown: begin,
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  };
}
