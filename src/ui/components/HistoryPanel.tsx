import { useGame } from '../../app/game';

const KIND_LABEL: Record<string, string> = {
  roll: 'Roll',
  reroll: 'ReRoll',
  add: 'Add',
  delete: 'Delete',
  move: 'Move',
  select: 'Select',
  clear: 'Clear',
};

export function HistoryPanel() {
  const { state } = useGame();
  const recent = state.history.slice(-5);

  if (recent.length === 0) return null;

  return (
    <div className="history">
      {recent.map((entry) => (
        <div key={entry.id} className="history-entry">
          {KIND_LABEL[entry.kind] ?? entry.kind}
          {entry.count > 0 ? ` ${entry.count}` : ''}
          {entry.value !== undefined ? `:${entry.value}` : ''}
        </div>
      ))}
    </div>
  );
}
