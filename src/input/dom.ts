export function targetValueAt(x: number, y: number): number | undefined {
  const el = document.elementFromPoint(x, y);
  const group = el?.closest?.('.group');
  const raw = group?.getAttribute('data-value');
  if (raw === null || raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isNaN(value) ? undefined : value;
}
