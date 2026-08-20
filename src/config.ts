type DiceFaceRotation = [number, number, number];

const base = import.meta.env.BASE_URL || '/';

export type ButtonKey = 'roll' | 'reroll' | 'add' | 'delete' | 'undo' | 'redo' | 'clear';

const buttons: Record<ButtonKey, string> = {
  roll: 'Roll',
  reroll: 'ReRoll',
  add: 'Add',
  delete: 'Delete',
  undo: 'Undo',
  redo: 'Redo',
  clear: 'Clear',
};

const buttonVisibility: Record<ButtonKey, boolean> = {
  roll: true,
  reroll: true,
  add: true,
  delete: true,
  undo: true,
  redo: true,
  clear: true,
};

// Поворот (x, y, z) в радианах, чтобы грань с этим значением смотрела на камеру (+Z).
const diceFaces: Record<number, DiceFaceRotation> = {
  1: [0, Math.PI / 2, 0],
  2: [0, -Math.PI / 2, 0],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
  5: [0, Math.PI, 0],
  6: [0, 0, 0],
};

export const config = {
  renderer: {
    animationDurationMs: 400,
    cameraPadding: 0.80,
    grabScale: 1.25,
    grabAnimMs: 120,
    dragFollowMs: 10,
    dragLift: 0,
    dragSpacing: 0.55,
    minPerRow: 0,
    maxPerRow: 0,
    plate: {
      verticalPadding: 0.15,
      horizontalPadding: 7.6,
      cornerRadius: 0.16,
      opacity: 0.02,
      selectedOpacity: 0.25,
      gradient: true,
      fadeMs: 250,
    },
    ambientLight: 0.6,
    keyLight: 1.2,
    shake: {
      zFrequency: 38,
      zAmplitude: 0.08,
      xFrequency: 29,
      xAmplitude: 0.05,
      xPhaseShift: 1.7,
      durationMs: 30000,
      decayMs: 400,
    },
    pixelate: {
      enabled: false,
      pixelSize: 3,
      normalEdgeStrength: 0,
      depthEdgeStrength: 0,
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
    swipeSensitivityPx: 5,
  },
  storage: {
    saveDebounceMs: 500,
  },
  pwa: {
    updateCheckIntervalMs: 10_000,
  },
  assets: {
    sounds: {
      appear: `${base}sounds/850097__lbrady240__pop11.wav`,
      roll: `${base}sounds/629982__flem0527__dice-rolling-on-table.wav`,
      disappear: `${base}sounds/poof.wav`,
    },
    diceModel: `${base}models/dice.glb`,
    diceFaces,
  },
  buttons,
  buttonVisibility,
  ui: {
    fontScale: 1,
    panels: {
      borders: false,
    },
    infoPanel: {
      centered: true,
      swipeHint: 'Swipe Finger to Add or Reduce Dices',
    },
    history: {
      kindLabels: {
        roll: 'Roll',
        reroll: 'ReRoll',
        add: 'Add',
        delete: 'Delete',
        move: 'Move',
        clear: 'Clear',
      } as Record<string, string>,
      format: '{kind}{count}{value}',
      countPrefix: ' ',
      valuePrefix: ':',
    },
  },
  vibration: {
    enabled: true,
    patterns: {
      roll: [40, 30, 40],
      select: 15,
      delete: 60,
      add: 20,
    },
  },
};
