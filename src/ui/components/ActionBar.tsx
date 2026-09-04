import { selectedDice } from '../../core/selection/selection';
import { useGame } from '../../app/game';
import { config } from '../../config';
import { InstallButton } from './InstallButton';

export function ActionBar() {
  const { state, dispatch, canUndo, canRedo } = useGame();
  const selectedCount = selectedDice(state.dice, state.selection).length;
  const hasDice = state.dice.length > 0;

  const label = (key: keyof typeof config.buttons) => {
    const value = config.buttons[key];
    return typeof value === 'string' ? value : value(selectedCount);
  };

  return (
    <div className="action-bar" style={{ borderTop: config.ui.panels.borders ? undefined : 'none' }}>
      <div className="action-row">
        <button disabled={!hasDice} onClick={() => dispatch({ type: 'delete' })}>
          {label('delete')}
        </button>
        <button onClick={() => dispatch({ type: 'add', count: selectedCount || 1 })}>
          {label('add')}
        </button>
        <button disabled={!hasDice} onClick={() => dispatch({ type: 'reroll' })}>
          {label('reroll')}
        </button>
      </div>
      <div className="action-row">
        <button disabled={!canUndo()} onClick={() => dispatch({ type: 'undo' })}>
          {label('undo')}
        </button>
        <button disabled={!canRedo()} onClick={() => dispatch({ type: 'redo' })}>
          {label('redo')}
        </button>
        {selectedCount > 0 ? (
          <button onClick={() => dispatch({ type: 'roll' })}>{label('roll')}</button>
        ) : (
          <button
            disabled={!hasDice}
            onClick={() => {
              if (window.confirm('Clear Table?')) {
                dispatch({ type: 'clear' });
              }
            }}
          >
            {label('clear')}
          </button>
        )}
      </div>
      <InstallButton />
    </div>
  );
}
