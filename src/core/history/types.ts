export type HistoryKind = 'roll' | 'reroll' | 'add' | 'delete' | 'move' | 'clear';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  kind: HistoryKind;
  count: number;
  value?: number;
  before?: number[];
  after?: number[];
}
