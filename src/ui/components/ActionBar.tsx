import { selectedDice } from '../../core/selection/selection';
import { useGame } from '../../app/game';

export function ActionBar() {
  const { state, dispatch, canUndo, canRedo } = useGame();
  const selectedCount = selectedDice(state.dice).length;
  const hasDice = state.dice.length > 0;

  return (
    <div className="action-bar">
      <button disabled={selectedCount === 0} onClick={() => dispatch({ type: 'roll' })}>
        Roll
      </button>
      <button disabled={!hasDice} onClick={() => dispatch({ type: 'reroll' })}>
        ReRoll
      </button>
      <button onClick={() => dispatch({ type: 'add', count: selectedCount || 1 })}>
        Add {selectedCount || 1}
      </button>
      <button disabled={!hasDice} onClick={() => dispatch({ type: 'delete' })}>
        {selectedCount > 0 ? `Delete ${selectedCount}` : 'Delete'}
      </button>
      <button disabled={!canUndo()} onClick={() => dispatch({ type: 'undo' })}>
        Undo
      </button>
      <button disabled={!canRedo()} onClick={() => dispatch({ type: 'redo' })}>
        Redo
      </button>
      <button
        disabled={!hasDice}
        onClick={() => {
          if (window.confirm('Clear the table?')) {
            dispatch({ type: 'clear' });
          }
        }}
      >
        Clear
      </button>
    </div>
  );
}
