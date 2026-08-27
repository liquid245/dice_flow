import { describe, expect, it } from 'vitest';
import { compactSlots } from './compactSlots';

interface Fixture {
  id: string;
  value: number;
}

function slot(id: string, value: number): Fixture {
  return { id, value };
}

describe('compactSlots', () => {
  it('removes freed slots and remaps live ids to new indices', () => {
    const slots = [slot('a', 1), slot('b', 2), slot('c', 3)];
    const idSlot = new Map<string, number>([
      ['a', 0],
      ['c', 2],
    ]);
    const result = compactSlots(slots, idSlot);
    expect(result.slots.map((s) => s.id)).toEqual(['a', 'c']);
    expect([...result.idSlot.entries()]).toEqual([
      ['a', 0],
      ['c', 1],
    ]);
  });

  it('drops entries whose stored id does not map to their index', () => {
    const slots = [slot('a', 1), slot('b', 2), slot('a', 3)];
    const idSlot = new Map<string, number>([['a', 2]]);
    const result = compactSlots(slots, idSlot);
    expect(result.slots.map((s) => s.id)).toEqual(['a']);
    expect([...result.idSlot.entries()]).toEqual([['a', 0]]);
  });

  it('preserves order of live entries', () => {
    const slots = [slot('a', 1), slot('b', 2), slot('c', 3), slot('d', 4)];
    const idSlot = new Map<string, number>([
      ['d', 3],
      ['a', 0],
      ['b', 1],
    ]);
    const result = compactSlots(slots, idSlot);
    expect(result.slots.map((s) => s.id)).toEqual(['a', 'b', 'd']);
    expect([...result.idSlot.entries()]).toEqual([
      ['a', 0],
      ['b', 1],
      ['d', 2],
    ]);
  });

  it('returns empty structures when nothing is live', () => {
    const slots = [slot('a', 1), slot('b', 2)];
    const idSlot = new Map<string, number>();
    const result = compactSlots(slots, idSlot);
    expect(result.slots).toEqual([]);
    expect(result.idSlot.size).toBe(0);
  });
});
