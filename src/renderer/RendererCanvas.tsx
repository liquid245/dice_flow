import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useGame } from '../app/game';
import { DiceRenderer } from './DiceRenderer';
import { useSwipeAdd } from '../input/useSwipeAdd';
import { useDragMove } from '../input/useDragMove';
import { useGroupSwipe } from '../input/useGroupSwipe';
import { useBackgroundTap } from '../input/useBackgroundTap';
import { TapCycleController, visualOrder } from '../input/tapCycle';
import type { HitTest } from '../input/hitTest';

export function RendererCanvas() {
  const { state, dispatch, beginTransaction, endTransaction, getState } = useGame();
  const engine = { dispatch, beginTransaction, endTransaction, getState };
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DiceRenderer | null>(null);
  const cycleRef = useRef(new TapCycleController());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new DiceRenderer(container);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.sync(state);
    renderer.render();
  }, [state]);

  const selectedCount = state.dice.filter((d) => d.selected).length;
  useEffect(() => {
    if (selectedCount === 0) cycleRef.current.reset();
  }, [selectedCount]);

  const order = visualOrder(state.dice);

  const hitTest: HitTest = {
    dieAt: (x, y) => rendererRef.current?.dieAt(x, y) ?? null,
    groupAt: (x, y) => rendererRef.current?.groupAt(x, y),
  };

  const swipe = useSwipeAdd(engine, () => state.swipeAddAvailable && state.dice.length === 0);
  const selectedIds = new Set(state.dice.filter((d) => d.selected).map((d) => d.id));
  const drag = useDragMove(
    engine,
    hitTest,
    (id) => dispatch(cycleRef.current.tap(order, id, selectedIds)),
    (fromId, toId) => dispatch(cycleRef.current.swipe(order, fromId, toId)),
    (fromId, toId) => {
      if (toId) {
        dispatch(cycleRef.current.swipe(order, fromId, toId));
      } else {
        cycleRef.current.reset();
      }
    },
    (drag) => rendererRef.current?.setDrag(drag),
  );
  const groupSwipe = useGroupSwipe(engine, hitTest);
  const backgroundTap = useBackgroundTap(engine, hitTest);

  function mergeHandlers(
    ...handlers: Array<(event: ReactPointerEvent<HTMLDivElement>) => void>
  ): (event: ReactPointerEvent<HTMLDivElement>) => void {
    return (event) => {
      for (const handler of handlers) handler(event);
    };
  }

  const pointerHandlers = {
    onPointerDown: mergeHandlers(swipe.onPointerDown, drag.onPointerDown, groupSwipe.onPointerDown, backgroundTap.onPointerDown),
    onPointerMove: mergeHandlers(swipe.onPointerMove, drag.onPointerMove, groupSwipe.onPointerMove),
    onPointerUp: mergeHandlers(swipe.onPointerUp, drag.onPointerUp, groupSwipe.onPointerUp),
    onPointerCancel: mergeHandlers(swipe.onPointerCancel, drag.onPointerCancel, groupSwipe.onPointerCancel),
  };

  return (
    <div ref={containerRef} className="table" {...pointerHandlers}>
      <span className="version-label">{__APP_VERSION__}</span>
    </div>
  );
}
