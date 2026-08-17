import type { PointerEvent as ReactPointerEvent } from 'react';
import type { InputEngine } from './engine';
import type { HitTest } from './hitTest';
import { hasSelection } from '../core/selection/selection';

export function useBackgroundTap(engine: InputEngine, hitTest: HitTest) {
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'mouse') return;
    const state = engine.getState();
    if (state.dice.length === 0) return;
    if (hitTest.dieAt(event.clientX, event.clientY)) return;
    if (hitTest.groupAt(event.clientX, event.clientY) !== undefined) return;
    if (hasSelection(state.selection)) {
      engine.dispatch({ type: 'select', ids: [], mode: 'set' });
    }
  }

  return { onPointerDown: down };
}
