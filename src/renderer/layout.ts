import type { DiceId, Die } from '../core/dice/types';
import { config } from '../config';

const DIE_SIZE = config.layout.dieSize;
const DIE_SPACING = config.layout.dieSpacing;
const GROUP_GAP = config.layout.groupGap;

export interface DiePosition {
  x: number;
  y: number;
  z: number;
}

export interface GroupBand {
  value: number;
  top: number;
  bottom: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Layout {
  positions: Map<DiceId, DiePosition>;
  bands: GroupBand[];
  bounds: Bounds;
}

export function layout(dice: Die[], maxPerRow: number): Layout {
  const positions = new Map<DiceId, DiePosition>();
  const bands: GroupBand[] = [];
  let cursor = 0;

  for (let value = 6; value >= 1; value--) {
    const groupDice = dice.filter((d) => d.value === value);
    const count = groupDice.length;
    const rows = count === 0 ? 1 : Math.max(1, Math.ceil(count / maxPerRow));

    const rowCounts = new Array<number>(rows).fill(0);
    for (let i = 0; i < count; i++) {
      rowCounts[Math.floor((i * rows) / count)]++;
    }

    const height = (rows - 1) * DIE_SPACING + DIE_SIZE;
    bands.push({ value, top: cursor, bottom: cursor - height });

    const rowIndex = new Array<number>(rows).fill(0);
    groupDice.forEach((die, i) => {
      const row = Math.floor((i * rows) / count);
      const col = rowIndex[row]++;
      const x = (col - (rowCounts[row] - 1) / 2) * DIE_SPACING;
      const y = cursor - DIE_SIZE / 2 - row * DIE_SPACING;
      positions.set(die.id, { x, y, z: 0 });
    });

    cursor -= height + GROUP_GAP;
  }

  return { positions, bands, bounds: computeBounds(positions, bands) };
}

function computeBounds(positions: Map<DiceId, DiePosition>, bands: GroupBand[]): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const position of positions.values()) {
    minX = Math.min(minX, position.x - DIE_SIZE / 2);
    maxX = Math.max(maxX, position.x + DIE_SIZE / 2);
  }
  if (minX === Infinity) {
    minX = -2;
    maxX = 2;
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (const band of bands) {
    minY = Math.min(minY, band.bottom);
    maxY = Math.max(maxY, band.top);
  }
  return { minX, maxX, minY, maxY };
}
