import { selectedDice } from '../../core/selection/selection';
import { useGame } from '../../app/game';
import { config, type ButtonKey } from '../../config';
import { InstallButton } from './InstallButton';

export function ActionBar() {
  const { state, dispatch, canUndo, canRedo } = useGame();
  const selectedCount = selectedDice(state.dice, state.selection).length;
  const hasDice = state.dice.length > 0;

  const isOn = (key: ButtonKey) => config.buttonVisibility[key];

  return (
    <div className="action-bar" style={{ borderTop: config.ui.panels.borders ? undefined : 'none' }}>
      <div className="action-row">
        {isOn('delete') && (
          <button disabled={!hasDice} onClick={() => dispatch({ type: 'delete' })}>
            {selectedCount > 0 ? `${config.buttons.delete} ${selectedCount}` : config.buttons.delete}
          </button>
        )}
        {isOn('add') && (
          <button onClick={() => dispatch({ type: 'add', count: selectedCount || 1 })}>
            {config.buttons.add} {selectedCount || 1}
          </button>
        )}
        {isOn('reroll') && (
          <button disabled={!hasDice} onClick={() => dispatch({ type: 'reroll' })}>
            {config.buttons.reroll}
          </button>
        )}
      </div>
      <div className="action-row">
        {isOn('undo') && (
          <button disabled={!canUndo()} onClick={() => dispatch({ type: 'undo' })}>
            {config.buttons.undo}
          </button>
        )}
        {isOn('redo') && (
          <button disabled={!canRedo()} onClick={() => dispatch({ type: 'redo' })}>
            {config.buttons.redo}
          </button>
        )}
        {selectedCount > 0 ? (
          isOn('roll') && (
            <button onClick={() => dispatch({ type: 'roll' })}>{config.buttons.roll}</button>
          )
        ) : (
          isOn('clear') && (
            <button
              disabled={!hasDice}
              onClick={() => {
                if (window.confirm('Clear the table?')) {
                  dispatch({ type: 'clear' });
                }
              }}
            >
              {config.buttons.clear}
            </button>
          )
        )}
      </div>
      <InstallButton />
    </div>
  );
}
