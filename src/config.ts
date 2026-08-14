export const config = {
  renderer: {
    animationDurationMs: 400,
    cameraPadding: 1.0,
    grabScale: 1.25,
    dragLift: 0,
    dragSpacing: 0.55,
    minPerRow: 4,
    maxPerRow: 10,
    plate: {
      verticalPadding: 0.15,
      horizontalPadding: 0.4,
      cornerRadius: 0.16,
      opacity: 0.08,
      selectedOpacity: 0.25,
    },
    ambientLight: 0.6,
    keyLight: 1.2,
    shake: {
      zFrequency: 38,
      zAmplitude: 0.08,
      xFrequency: 29,
      xAmplitude: 0.05,
      xPhaseShift: 1.7,
    },
  },
  layout: {
    dieSize: 1,
    dieSpacing: 1.3,
    groupGap: 0.4,
  },
  input: {
    dragThresholdPx: 8,
    dragDelayMs: 1000,
    pixelsPerDie: 28,
  },
  storage: {
    saveDebounceMs: 500,
  },
};
