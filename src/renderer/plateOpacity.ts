export function plateOpacity(selected: number, total: number, min: number, max: number): number {
  if (total <= 0) return min;
  const t = selected / total;
  return min + (max - min) * t;
}
