import type { Action } from '../core/actions/types';
import type { GameState } from '../core/game/state';

export interface InputEngine {
  dispatch(action: Action): void;
  beginTransaction(): void;
  endTransaction(): void;
  getState(): GameState;
}
