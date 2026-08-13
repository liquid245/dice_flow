import type { DiceId, Die } from '../core/dice/types';

export const DIE_SPACING = 1.3;
export const GROUP_SPACING = 2.0;
export const MAX_PER_ROW = 8;

export interface DiePosition {
  x: number;
  y: number;
  z: number;
}

export function groupY(value: number): number {
  return (value - 6) * GROUP_SPACING;
}

export function valueFromY(y: number): number {
  const rowIndex = Math.round(-y / GROUP_SPACING);
  return Math.max(1, Math.min(6, 6 - rowIndex));
}

export function layoutPositions(dice: Die[]): Map<DiceId, DiePosition> {
  const positions = new Map<DiceId, DiePosition>();
  for (let value = 6; value >= 1; value--) {
    const groupDice = dice.filter((d) => d.value === value);
    groupDice.forEach((die, i) => {
      const row = Math.floor(i / MAX_PER_ROW);
      const rowStart = row * MAX_PER_ROW;
      const rowCount = Math.min(groupDice.length - rowStart, MAX_PER_ROW);
      const col = i - rowStart;
      const x = (col - (rowCount - 1) / 2) * DIE_SPACING;
      const y = groupY(value) - row * DIE_SPACING;
      positions.set(die.id, { x, y, z: 0 });
    });
  }
  return positions;
}
