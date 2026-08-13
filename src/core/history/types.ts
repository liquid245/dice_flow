export type HistoryKind = 'roll' | 'reroll' | 'add' | 'delete' | 'move' | 'select' | 'clear';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  kind: HistoryKind;
  count: number;
  value?: number;
}
