import { useGame } from '../../app/game';

export function InfoPanel() {
  const { state } = useGame();
  const selected = state.dice.filter((d) => d.selected).length;

  return (
    <div className="info-panel">
      <span>{state.dice.length} D6</span>
      {selected > 0 && <span> · Selected: {selected}</span>}
    </div>
  );
}
