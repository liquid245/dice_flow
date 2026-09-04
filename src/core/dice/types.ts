export type DiceId = string;

export type DiceType = 'd6';

export type OperationKind = 'roll' | 'reroll' | 'add' | 'move';

export function isD6Value(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
}

export interface Die {
  id: DiceId;
  type: DiceType;
  value: number;
  origin: OperationKind;
  rev?: number;
}
