import { useGame } from '../../app/game';
import { changesSinceLastRoll } from '../../core/history/selectors';
import type { HistoryEntry } from '../../core/history/types';

const KIND_LABEL: Record<string, string> = {
  roll: 'Roll',
  reroll: 'ReRoll',
  add: 'Add',
  delete: 'Delete',
  move: 'Move',
  clear: 'Clear',
};

function formatEntry(entry: HistoryEntry): string {
  const kind = KIND_LABEL[entry.kind] ?? entry.kind;
  const count = entry.count > 0 ? ` ${entry.count}` : '';
  const value = entry.value !== undefined ? `:${entry.value}` : '';
  return `${kind}${count}${value}`;
}

export function InfoPanel() {
  const { state } = useGame();
  const selected = state.dice.filter((d) => d.selected).length;
  const changes = changesSinceLastRoll(state.history);

  return (
    <div className="info-panel">
      <span>{state.dice.length} D6</span>
      {changes.map((entry) => (
        <span key={entry.id}> · {formatEntry(entry)}</span>
      ))}
      {selected > 0 && <span> · Selected: {selected}</span>}
    </div>
  );
}
