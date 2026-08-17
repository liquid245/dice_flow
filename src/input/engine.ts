import type { GameEngine } from '../core/game/engine';

export type InputEngine = Pick<
  GameEngine,
  'dispatch' | 'beginTransaction' | 'endTransaction' | 'getState' | 'random'
>;
