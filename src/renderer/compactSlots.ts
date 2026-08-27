export interface Compacted<T> {
  slots: T[];
  idSlot: Map<string, number>;
}

export function compactSlots<T extends { id: string }>(slots: T[], idSlot: Map<string, number>): Compacted<T> {
  const compacted: T[] = [];
  const remapped = new Map<string, number>();
  for (let i = 0; i < slots.length; i++) {
    const entry = slots[i];
    if (!entry || idSlot.get(entry.id) !== i) continue;
    const newIndex = compacted.length;
    compacted.push(entry);
    remapped.set(entry.id, newIndex);
  }
  return { slots: compacted, idSlot: remapped };
}
