import { describe, expect, it } from 'vitest';
import { normalizeState } from './state';
import type { GameState } from './state';

describe('normalizeState', () => {
  it('drops persisted dice with values outside the D6 range', () => {
    const state = normalizeState({
      dice: [
        { id: 'valid', type: 'd6', value: 6, origin: 'add' },
        { id: 'zero', type: 'd6', value: 0, origin: 'add' },
        { id: 'high', type: 'd6', value: 7, origin: 'add' },
        { id: 'fraction', type: 'd6', value: 2.5, origin: 'add' },
        { id: 'text', type: 'd6', value: '3', origin: 'add' },
      ],
    } as unknown as GameState);

    expect(state.dice.map((die) => die.id)).toEqual(['valid']);
  });
});
