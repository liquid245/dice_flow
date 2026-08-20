import { useEffect } from 'react';
import { selectedDice } from '../../core/selection/selection';
import { useGame } from '../../app/game';
import { config, type ButtonKey } from '../../config';
import { InstallButton } from './InstallButton';

export function ActionBar() {
  const { state, dispatch, canUndo, canRedo } = useGame();
  const selectedCount = selectedDice(state.dice, state.selection).length;
  const hasDice = state.dice.length > 0;

  const isOn = (key: ButtonKey) => config.buttonVisibility[key];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.('button');
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * 100 : 50;
      const y = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * 100 : 50;
      (target as HTMLElement).style.setProperty('--press-x', `${x.toFixed(1)}%`);
      (target as HTMLElement).style.setProperty('--press-y', `${y.toFixed(1)}%`);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

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
