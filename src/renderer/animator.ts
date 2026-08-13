export interface DieSnapshot {
  id: string;
  value: number;
  x: number;
  y: number;
}

export type Transition =
  | { kind: 'appear'; id: string; x: number; y: number; value: number }
  | { kind: 'remove'; id: string; x: number; y: number }
  | {
      kind: 'change';
      id: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      fromValue: number;
      toValue: number;
    };

export function computeTransitions(prev: DieSnapshot[], next: DieSnapshot[]): Transition[] {
  const prevById = new Map(prev.map((p) => [p.id, p]));
  const nextById = new Map(next.map((n) => [n.id, n]));
  const transitions: Transition[] = [];

  for (const n of next) {
    const p = prevById.get(n.id);
    if (!p) {
      transitions.push({ kind: 'appear', id: n.id, x: n.x, y: n.y, value: n.value });
    } else if (p.value !== n.value || p.x !== n.x || p.y !== n.y) {
      transitions.push({
        kind: 'change',
        id: n.id,
        fromX: p.x,
        fromY: p.y,
        toX: n.x,
        toY: n.y,
        fromValue: p.value,
        toValue: n.value,
      });
    }
  }

  for (const p of prev) {
    if (!nextById.has(p.id)) transitions.push({ kind: 'remove', id: p.id, x: p.x, y: p.y });
  }

  return transitions;
}
