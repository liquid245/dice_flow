export interface DieHit {
  id: string;
  value: number;
}

export interface HitTest {
  dieAt(clientX: number, clientY: number): DieHit | null;
  groupAt(clientX: number, clientY: number): number | undefined;
}
