import type { DiceId } from '../dice/types';

export interface EngineDeps {
  random: () => number;
  nextId: () => DiceId;
  now: () => number;
}
