export function faceArrangement(value: number): number[] {
  const back = 7 - value;
  const sides = [1, 2, 3, 4, 5, 6].filter((v) => v !== value && v !== back);
  return [sides[0], sides[1], sides[2], sides[3], value, back];
}
