import type { DiceId, Die } from '../core/dice/types';
import { config } from '../config';

const DIE_SIZE = config.layout.dieSize;
const DIE_SPACING = config.layout.dieSpacing;
const GROUP_GAP = config.layout.groupGap;
const CAMERA_PADDING = config.renderer.cameraPadding;

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

const VALUES = [6, 5, 4, 3, 2, 1];

interface ColumnOption {
  cols: number;
  width: number;
  height: number;
}

function widthFor(count: number, rows: number): number {
  const widest = Math.ceil(count / rows);
  return (widest - 1) * DIE_SPACING + DIE_SIZE;
}

function heightFor(rows: number): number {
  return (rows - 1) * DIE_SPACING + DIE_SIZE;
}

function columnOptions(count: number, maxPerRow: number): ColumnOption[] {
  const options: ColumnOption[] = [];
  const maxCols = Math.min(count, maxPerRow);
  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(count / cols);
    options.push({ cols, width: widthFor(count, rows), height: heightFor(rows) });
  }
  return options;
}

function chooseColumns(counts: number[], options: (ColumnOption[] | null)[], aspect: number): number[] {
  const groups: { index: number; options: ColumnOption[] }[] = [];
  for (let i = 0; i < counts.length; i++) {
    if (options[i] != null) groups.push({ index: i, options: options[i]! });
  }

  const result = counts.map(() => 1);
  if (groups.length === 0) return result;

  let best: { cols: number[]; objective: number } | null = null;

  // For each candidate table width (every column variant of every group),
  // shrink the other groups to fit that width and measure the free space.
  for (const widest of groups) {
    for (const candidate of widest.options) {
      const width = candidate.width;
      const cols = new Array<number>(groups.length).fill(0);
      let height = 0;
      let feasible = true;

      for (let gi = 0; gi < groups.length; gi++) {
        let pick: ColumnOption | null = null;
        for (const option of groups[gi].options) {
          if (option.width <= width) pick = option;
        }
        if (!pick) {
          feasible = false;
          break;
        }
        cols[gi] = pick.cols;
        height += pick.height;
      }
      if (!feasible) continue;

      height += (groups.length - 1) * GROUP_GAP;
      const objective = Math.max(
        width + CAMERA_PADDING * 2,
        (height + CAMERA_PADDING * 2) * aspect,
      );
      if (!best || objective < best.objective) {
        best = { cols, objective };
      }
    }
  }

  for (let gi = 0; gi < groups.length; gi++) {
    result[groups[gi].index] = best!.cols[gi];
  }
  return result;
}

export function layout(dice: Die[], maxPerRow: number, aspect: number): Layout {
  const grouped = new Map<number, Die[]>();
  for (const die of dice) {
    const list = grouped.get(die.value);
    if (list) list.push(die);
    else grouped.set(die.value, [die]);
  }

  const counts = VALUES.map((value) => grouped.get(value)?.length ?? 0);
  const options = counts.map((count) => (count > 0 ? columnOptions(count, maxPerRow) : null));
  const colsPerGroup = chooseColumns(counts, options, aspect);

  const positions = new Map<DiceId, DiePosition>();
  const bands: GroupBand[] = [];
  let cursor = 0;

  for (let gi = 0; gi < VALUES.length; gi++) {
    const value = VALUES[gi];
    const count = counts[gi];
    const cols = count > 0 ? colsPerGroup[gi] : 1;
    const rows = count === 0 ? 1 : Math.max(1, Math.ceil(count / cols));

    const rowCounts = new Array<number>(rows).fill(0);
    for (let i = 0; i < count; i++) {
      rowCounts[Math.floor((i * rows) / count)]++;
    }

    const height = (rows - 1) * DIE_SPACING + DIE_SIZE;
    bands.push({ value, top: cursor, bottom: cursor - height });

    const groupDice = grouped.get(value) ?? [];
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
