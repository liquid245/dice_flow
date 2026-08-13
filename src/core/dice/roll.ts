export const D6_MIN = 1;
export const D6_MAX = 6;

export function rollD6(random: () => number): number {
  return Math.floor(random() * (D6_MAX - D6_MIN + 1)) + D6_MIN;
}
