import type { GameAction } from '../core/actions/types';

export const DRAG_THRESHOLD_PX = 8;

export function exceedsThreshold(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  threshold: number = DRAG_THRESHOLD_PX,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return dx * dx + dy * dy >= threshold * threshold;
}

export function moveTarget(
  startValue: number,
  selectedCount: number,
  targetValue: number | undefined,
): GameAction | null {
  if (targetValue === undefined || targetValue < 1 || targetValue > 6) return null;
  if (selectedCount <= 1 && targetValue === startValue) return null;
  return { type: 'move', targetValue };
}
