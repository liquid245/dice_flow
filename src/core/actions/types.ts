import type { DiceId } from '../dice/types';

export type SelectMode = 'set' | 'toggle' | 'add' | 'remove';

export type GameAction =
  | { type: 'roll' }
  | { type: 'reroll' }
  | { type: 'add'; count: number; values?: number[] }
  | { type: 'delete'; count?: number }
  | { type: 'move'; targetValue: number }
  | { type: 'select'; ids: DiceId[]; mode: SelectMode }
  | { type: 'clear' };

export type Action = GameAction | { type: 'undo' } | { type: 'redo' };
