import { groupByValue } from '../../core/groups/groups';
import { useGame } from '../../app/game';
import { useSwipeAdd } from '../../input/useSwipeAdd';

const GROUP_VALUES = [6, 5, 4, 3, 2, 1];

export function GameTable() {
  const { state, dispatch, beginTransaction, endTransaction } = useGame();
  const swipe = useSwipeAdd(
    { dispatch, beginTransaction, endTransaction },
    () => state.swipeAddAvailable && state.dice.length === 0,
  );

  if (state.dice.length === 0) {
    return (
      <div className="table" {...swipe}>
        <div className="empty-table">Swipe Finger to Add or Reduse Dices</div>
      </div>
    );
  }

  const groups = groupByValue(state.dice);

  return (
    <div className="table" {...swipe}>
      {GROUP_VALUES.map((value) => {
        const dice = groups.get(value) ?? [];
        return (
          <div
            key={value}
            className="group"
            onClick={() => dispatch({ type: 'select', ids: dice.map((d) => d.id), mode: 'set' })}
          >
            <span className="group-label">{value}</span>
            <div className="dice">
              {dice.map((die) => (
                <button
                  key={die.id}
                  className={die.selected ? 'die selected' : 'die'}
                  onClick={(event) => {
                    event.stopPropagation();
                    dispatch({ type: 'select', ids: [die.id], mode: 'toggle' });
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
