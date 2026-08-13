import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { groupByValue } from '../../core/groups/groups';
import { useGame } from '../../app/game';
import { useSwipeAdd } from '../../input/useSwipeAdd';
import { useDragMove } from '../../input/useDragMove';
import { TapCycleController, visualOrder } from '../../input/tapCycle';

const GROUP_VALUES = [6, 5, 4, 3, 2, 1];

export function GameTable() {
  const { state, dispatch, beginTransaction, endTransaction, getState } = useGame();
  const engine = { dispatch, beginTransaction, endTransaction, getState };
  const cycleRef = useRef(new TapCycleController());
  const swipe = useSwipeAdd(engine, () => state.swipeAddAvailable && state.dice.length === 0);
  const drag = useDragMove(engine);

  const selectedCount = state.dice.filter((d) => d.selected).length;
  useEffect(() => {
    if (selectedCount === 0) cycleRef.current.reset();
  }, [selectedCount]);

  function mergeHandlers(
    first: (event: ReactPointerEvent<HTMLDivElement>) => void,
    second: (event: ReactPointerEvent<HTMLDivElement>) => void,
  ): (event: ReactPointerEvent<HTMLDivElement>) => void {
    return (event) => {
      first(event);
      second(event);
    };
  }

  const pointerHandlers = {
    onPointerDown: mergeHandlers(swipe.onPointerDown, drag.onPointerDown),
    onPointerMove: mergeHandlers(swipe.onPointerMove, drag.onPointerMove),
    onPointerUp: mergeHandlers(swipe.onPointerUp, drag.onPointerUp),
    onPointerCancel: mergeHandlers(swipe.onPointerCancel, drag.onPointerCancel),
  };

  if (state.dice.length === 0) {
    return (
      <div className="table" {...pointerHandlers}>
        <div className="empty-table">Swipe Finger to Add or Reduse Dices</div>
      </div>
    );
  }

  const groups = groupByValue(state.dice);
  const order = visualOrder(state.dice);

  return (
    <div className="table" {...pointerHandlers}>
      {GROUP_VALUES.map((value) => {
        const dice = groups.get(value) ?? [];
        return (
          <div
            key={value}
            className="group"
            data-value={value}
            onClick={() => {
              cycleRef.current.reset();
              dispatch({ type: 'select', ids: dice.map((d) => d.id), mode: 'set' });
            }}
          >
            <span className="group-label">{value}</span>
            <div className="dice">
              {dice.map((die) => (
                <button
                  key={die.id}
                  className={die.selected ? 'die selected' : 'die'}
                  data-die-id={die.id}
                  data-die-value={die.value}
                  onClick={(event) => {
                    event.stopPropagation();
                    dispatch(cycleRef.current.tap(order, die.id));
                  }}
                >
                  {die.value}
                </button>
              ))}
            </div>
            <span className="group-count">{dice.length}</span>
          </div>
        );
      })}
    </div>
  );
}
