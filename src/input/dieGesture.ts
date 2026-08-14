export type DieGesturePhase = 'idle' | 'pressed' | 'swiping' | 'dragging';

export type DieGestureOutcome = 'tap' | 'swipe' | 'drag';

export class DieGestureController {
  private phase: DieGesturePhase = 'idle';

  down(): void {
    this.phase = 'pressed';
  }

  move(exceedsThreshold: boolean): void {
    if (this.phase === 'pressed' && exceedsThreshold) {
      this.phase = 'swiping';
    }
  }

  timerExpired(): void {
    if (this.phase === 'pressed') {
      this.phase = 'dragging';
    }
  }

  up(): DieGestureOutcome {
    const outcome: DieGestureOutcome =
      this.phase === 'dragging' ? 'drag' : this.phase === 'swiping' ? 'swipe' : 'tap';
    this.phase = 'idle';
    return outcome;
  }

  cancel(): void {
    this.phase = 'idle';
  }

  isDragging(): boolean {
    return this.phase === 'dragging';
  }

  isSwiping(): boolean {
    return this.phase === 'swiping';
  }
}
