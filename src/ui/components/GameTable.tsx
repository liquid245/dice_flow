import { useEffect, useRef } from 'react';
import { groupByValue } from '../../core/groups/groups';
import { useGame } from '../../app/game';
import { useSwipeAdd } from '../../input/useSwipeAdd';
import { TapCycleController, visualOrder } from '../../input/tapCycle';

const GROUP_VALUES = [6, 5, 4, 3, 2, 1];

export function GameTable() {
  const { state, dispatch, beginTransaction, endTransaction } = useGame();
  const cycleRef = useRef(new TapCycleController());
  const swipe = useSwipeAdd(
    { dispatch, beginTransaction, endTransaction },
    () => state.swipeAddAvailable && state.dice.length === 0,
  );

  const selectedCount = state.dice.filter((d) => d.selected).length;
  useEffect(() => {
    if (selectedCount === 0) cycleRef.current.reset();
  }, [selectedCount]);

  if (state.dice.length === 0) {
    return (
      <div className="table" {...swipe}>
        <div className="empty-table">Swipe Finger to Add or Reduse Dices</div>
      </div>
    );
  }

  const groups = groupByValue(state.dice);
  const order = visualOrder(state.dice);

  return (
    <div className="table" {...swipe}>
      {GROUP_VALUES.map((value) => {
        const dice = groups.get(value) ?? [];
        return (
          <div
            key={value}
            className="group"
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
