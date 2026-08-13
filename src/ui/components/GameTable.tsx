import { groupByValue } from '../../core/groups/groups';
import { useGame } from '../../app/game';

const GROUP_VALUES = [6, 5, 4, 3, 2, 1];

export function GameTable() {
  const { state, dispatch } = useGame();

  if (state.dice.length === 0) {
    return <div className="empty-table">Swipe Finger to Add or Reduse Dices</div>;
  }

  const groups = groupByValue(state.dice);

  return (
    <div className="table">
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
