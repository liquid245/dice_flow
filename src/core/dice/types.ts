export type DiceId = string;

export type DiceType = 'd6';

export type OperationKind = 'roll' | 'reroll' | 'add' | 'move';

export interface Die {
  id: DiceId;
  type: DiceType;
  value: number;
  origin: OperationKind;
}
