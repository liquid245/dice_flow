import { useGame } from '../../app/game';
import { changesSinceLastRoll } from '../../core/history/selectors';
import type { HistoryEntry } from '../../core/history/types';
import { config } from '../../config';

function formatEntry(entry: HistoryEntry): string {
  const history = config.ui.history;
  const kind = history.kindLabels[entry.kind] ?? entry.kind;
  const count = entry.count > 0 ? `${history.countPrefix}${entry.count}` : '';
  const value = entry.value !== undefined ? `${history.valuePrefix}${entry.value}` : '';
  return history.format.replace('{kind}', kind).replace('{count}', count).replace('{value}', value);
}

export function InfoPanel() {
  const { state } = useGame();
  const selected = state.dice.filter((d) => d.selected).length;
  const changes = changesSinceLastRoll(state.history);
  const infoPanel = config.ui.infoPanel;

  return (
    <div className="info-panel" style={{ textAlign: infoPanel.centered ? 'center' : 'left' }}>
      {state.dice.length === 0 ? (
        <span>{infoPanel.swipeHint}</span>
      ) : (
        <>
          <span>{state.dice.length} D6</span>
          {changes.map((entry) => (
            <span key={entry.id}> · {formatEntry(entry)}</span>
          ))}
          {selected > 0 && <span> · Selected: {selected}</span>}
        </>
      )}
    </div>
  );
}
