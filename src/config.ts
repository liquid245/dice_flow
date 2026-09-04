type DiceFaceRotation = [number, number, number];

const base = import.meta.env.BASE_URL || '/';

export type StatusMessageKey = 'version' | 'downloading' | 'ready' | 'muted' | 'selection';

type Label = string | ((selectedCount: number) => string);

const buttons: Record<'roll' | 'reroll' | 'add' | 'delete' | 'undo' | 'redo' | 'clear', Label> = {
  roll: 'Roll Selected',
  reroll: (n) => (n > 0 ? 'Reroll Selected' : 'Reroll All'),
  add: (n) => (n === 0 ? 'Add One Die' : `Add ${n} ${n === 1 ? 'Die' : 'Dice'}`),
  delete: (n) => (n > 0 ? 'Delete Selected' : 'Delete Last'),
  undo: 'Undo',
  redo: 'Redo',
  clear: 'Clear Table',
};

// Поворот (x, y, z) в радианах, чтобы грань с этим значением смотрела на камеру (+Z).
// Рендерер работает в мировых координатах (mergeByMaterial применяет matrixWorld),
// поэтому тут мировые грани модели dice-2.glb: +X=6, -X=1, +Y=3, -Y=4, +Z=2, -Z=5.
// Локальные грани модели: +X=6, -X=1, +Y=5, -Y=2, +Z=3, -Z=4 (из-за поворота корня сцены).
const diceFaces: Record<number, DiceFaceRotation> = {
  1: [0, Math.PI / 2, 0],
  2: [0, 0, 0],
  3: [Math.PI / 2, 0, 0],
  4: [-Math.PI / 2, 0, 0],
  5: [0, Math.PI, 0],
  6: [0, -Math.PI / 2, 0],
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
      decayMs: 200,
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
    // old model: ${base}models/dice.glb (для отката — файл и строки сохранены)
    diceModel: `${base}models/dice-2.glb`,
    diceFaces,
  },
  buttons,
  ui: {
    fontScale: 1,
    panels: {
      borders: false,
    },
    infoPanel: {
      centered: true,
      swipeHint: 'Swipe finger to add or reduce dices',
    },
    statusLine: {
      // Messages that replace the version number, top = higher priority.
      // "selection" shows a countdown bar while dice are selected and must stay first.
      // "version" is the always-on fallback and must normally stay last.
      priority: ['selection', 'muted', 'ready', 'downloading', 'version'] as StatusMessageKey[],
    },
    history: {
      verbs: {
        roll: 'Roll',
        reroll: 'Reroll',
        add: 'Add',
        delete: 'Remove',
        move: 'Move',
        clear: 'Clear',
      } as Record<string, string>,
      arrow: '→',
      pluralSuffix: 's',
      totalWord: 'Total',
      selectWord: 'Selected',
      someWord: 'some of',
      listSep: ', ',
      segmentSep: ' · ',
    },
  },
  vibration: {
    enabled: true,
    session: {
      enabled: true,
      burstMs: 20,
      intervalMs: 40,
      stopIntensity: 0.05,
    },
    patterns: {
      roll: [40, 30, 40],
      select: 15,
      delete: 60,
      add: 20,
    },
    thump: {
      enabled: true,
      frequency: 90,
      frequencyEnd: 55,
      duration: 70,
      gain: 0.35,
      click: true,
    },
  },
};
