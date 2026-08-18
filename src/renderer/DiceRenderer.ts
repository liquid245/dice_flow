import * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import type { GameState } from '../core/game/state';
import type { DiceId, Die } from '../core/dice/types';
import { isDieSelected } from '../core/selection/selection';
import { loadDiceModel, type LodGroup } from './dice';
import { layout, type Layout } from './layout';
import { computeTransitions, type DieSnapshot, type Transition } from './animator';
import type { DieHit } from '../input/hitTest';
import { config } from '../config';
import { playSound, type SoundName } from '../services/audio';
import { vibrate, type VibrationName } from '../services/vibration';
import { plateOpacity } from './plateOpacity';

type Tween =
  | { kind: 'appear'; id: DiceId }
  | { kind: 'remove'; id: DiceId }
  | { kind: 'slide'; id: DiceId; fromX: number; fromY: number; toX: number; toY: number }
  | {
      kind: 'change';
      id: DiceId;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      fromValue: number;
      toValue: number;
      valueApplied: boolean;
      spin: boolean;
    };

interface DieInstance {
  id: DiceId;
  value: number;
  x: number;
  y: number;
  scale: number;
  selected: boolean;
  shakePhase: number;
  dying: boolean;
}

const DEFAULT_CAPACITY = 512;

export class DiceRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private composer: EffectComposer | null = null;
  private pixelPass: RenderPixelatedPass | null = null;
  private raycaster = new THREE.Raycaster();
  private currentSize = { width: 0, height: 0 };
  private materialGroups: LodGroup[] = [];
  private instanced: THREE.InstancedMesh[] = [];
  private capacity = DEFAULT_CAPACITY;
  private ready = false;
  private currentSize = { width: 0, height: 0 };

  private slots: DieInstance[] = [];
  private idSlot = new Map<DiceId, number>();
  private freeSlots: number[] = [];
  private selected = new Set<DiceId>();
  private selectionSince: number | null = null;
  private shakeActive = false;
  private groupsByValue = new Map<number, Die[]>();

  private plates = new Map<number, THREE.Mesh>();
  private layout: Layout = { positions: new Map(), bands: [], bounds: { minX: -2, maxX: 2, minY: -1, maxY: 0 } };
  private lastState: GameState | null = null;
  private maxPerRow = 6;
  private prev: DieSnapshot[] = [];
  private tweens: Tween[] = [];
  private tweenIds = new Set<DiceId>();
  private tweenStart = 0;
  private rafId: number | null = null;
  private hasDice = false;
  private synced = false;
  private dirty = false;

  private dragId: DiceId | null = null;
  private dragSolo = false;
  private dragOffsets = new Map<DiceId, { x: number; y: number }>();
  private dragCursor: { x: number; y: number } | null = null;
  private dragTarget: number | null = null;
  private pendingDragReset = new Set<DiceId>();

  private plateTargets = new Map<number, number>();
  private plateFades = new Map<number, { from: number; start: number }>();

  private scaleTargets = new Map<DiceId, number>();
  private scaleFades = new Map<DiceId, { from: number; start: number }>();

  private faceQuats: THREE.Quaternion[] = [];
  private qIdentity = new THREE.Quaternion();
  private qA = new THREE.Quaternion();
  private qB = new THREE.Quaternion();
  private eul = new THREE.Euler();
  private pos = new THREE.Vector3();
  private scl = new THREE.Vector3();
  private mat = new THREE.Matrix4();
  private planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private planeHit = new THREE.Vector3();
  private ndcVec = new THREE.Vector2();

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.set(0, -5, 10);
    this.camera.lookAt(0, -5, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, config.renderer.ambientLight));
    const key = new THREE.DirectionalLight(0xffffff, config.renderer.keyLight);
    key.position.set(5, 5, 10);
    this.scene.add(key);

    for (let value = 1; value <= 6; value++) {
      const [x, y, z] = config.assets.diceFaces[value];
      this.eul.set(x, y, z);
      this.faceQuats[value] = new THREE.Quaternion().setFromEuler(this.eul);
    }

    this.createPlates();

    if (config.renderer.pixelate.enabled) {
      void this.setupPixelation();
    }

    loadDiceModel()
      .then((groups) => {
        this.materialGroups = groups;
        this.rebuildInstanced();
        this.writeAllMatrices(performance.now());
        this.ready = true;
        if (this.lastState) this.sync(this.lastState);
      })
      .catch((error) => console.error('Failed to load dice model', error));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private async setupPixelation(): Promise<void> {
    const [{ EffectComposer }, { RenderPixelatedPass }, { OutputPass }] = await Promise.all([
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPixelatedPass.js'),
      import('three/examples/jsm/postprocessing/OutputPass.js'),
    ]);
    const pixelate = config.renderer.pixelate;
    this.pixelPass = new RenderPixelatedPass(pixelate.pixelSize, this.scene, this.camera, {
      normalEdgeStrength: pixelate.normalEdgeStrength,
      depthEdgeStrength: pixelate.depthEdgeStrength,
    });
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(this.pixelPass);
    this.composer.addPass(new OutputPass());
    this.composer.setSize(this.renderer.domElement.width, this.renderer.domElement.height);
    this.render();
  }

  private createPlates(): void {
    for (let value = 6; value >= 1; value--) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: config.renderer.plate.opacity,
        depthWrite: false,
      });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      plate.position.z = -0.5;
      this.plates.set(value, plate);
      this.scene.add(plate);
    }
  }

  private updatePlateGeometry(): void {
    const plate = config.renderer.plate;
    const width = this.layout.bounds.maxX - this.layout.bounds.minX + plate.horizontalPadding * 2;
    for (const band of this.layout.bands) {
      const mesh = this.plates.get(band.value);
      if (!mesh) continue;
      const height = band.top - band.bottom + plate.verticalPadding * 2;
      mesh.geometry.dispose();
      mesh.geometry = createRoundedRectGeometry(width, height, plate.cornerRadius);
      mesh.position.set(0, (band.top + band.bottom) / 2, -0.5);
    }
  }

  private updatePlateHighlights(): void {
    const now = performance.now();
    for (const band of this.layout.bands) {
      const target = this.plateTargetOpacity(band.value);
      const prev = this.plateTargets.get(band.value);
      if (prev === target) continue;
      this.plateTargets.set(band.value, target);
      const mesh = this.plates.get(band.value);
      if (!mesh) continue;
      const material = mesh.material as THREE.MeshBasicMaterial;
      if (Math.abs(material.opacity - target) < 0.001) {
        material.opacity = target;
      } else {
        this.plateFades.set(band.value, { from: material.opacity, start: now });
      }
    }
    if (this.plateFades.size > 0) this.ensureLoop();
  }

  private plateTargetOpacity(value: number): number {
    const plate = config.renderer.plate;
    if (this.dragTarget !== null && value === this.dragTarget) return plate.selectedOpacity;
    const group = this.groupsByValue.get(value) ?? [];
    if (group.length === 0) {
      return this.groupHighlighted(value) ? plate.selectedOpacity : plate.opacity;
    }
    if (config.renderer.plate.gradient) {
      const selected = group.filter((d) => this.selected.has(d.id)).length;
      return plateOpacity(selected, group.length, plate.opacity, plate.selectedOpacity);
    }
    return this.groupHighlighted(value) ? plate.selectedOpacity : plate.opacity;
  }

  private stepPlateFade(now: number): boolean {
    const tau = config.renderer.plate.fadeMs;
    let active = false;
    for (const [value, fade] of this.plateFades) {
      const mesh = this.plates.get(value);
      const target = this.plateTargets.get(value);
      if (!mesh || target === undefined) {
        this.plateFades.delete(value);
        continue;
      }
      const material = mesh.material as THREE.MeshBasicMaterial;
      const t = tau <= 0 ? 1 : (now - fade.start) / tau;
      if (t >= 1) {
        material.opacity = target;
        this.plateFades.delete(value);
      } else {
        const e = 1 - Math.pow(1 - t, 3);
        material.opacity = fade.from + (target - fade.from) * e;
        active = true;
      }
    }
    return active;
  }

  private stepScaleFade(now: number): boolean {
    const duration = config.renderer.grabAnimMs;
    let active = false;
    for (const [id, fade] of this.scaleFades) {
      const slot = this.idSlot.get(id);
      const target = this.scaleTargets.get(id);
      if (slot == null || target === undefined) {
        this.scaleFades.delete(id);
        continue;
      }
      const die = this.slots[slot];
      const t = duration <= 0 ? 1 : (now - fade.start) / duration;
      if (t >= 1) {
        die.scale = target;
        this.writeMatrix(slot, now);
        this.scaleFades.delete(id);
      } else {
        const e = 1 - Math.pow(1 - t, 3);
        die.scale = fade.from + (target - fade.from) * e;
        this.writeMatrix(slot, now);
        active = true;
      }
    }
    return active;
  }

  private groupHighlighted(value: number): boolean {
    const group = this.groupsByValue.get(value) ?? [];
    if (group.length > 0) return group.every((d) => this.selected.has(d.id));
    const selection = this.lastState?.selection;
    return selection != null && selection.kind === 'range' && value >= selection.min && value <= selection.max;
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.animateSizeTransition(width, height);
    this.sizeTween.tween.set({ width, height }).start();
    this.maxPerRow = config.renderer.maxPerRow;
    this.relayout();
    this.render();
  }

  private get aspect(): number {
    return (this.container.clientWidth || 1) / (this.container.clientHeight || 1);
  }

  private relayout(): void {
    const dice = this.lastState ? this.lastState.dice : [];
    this.layout = layout(dice, this.maxPerRow, this.aspect);
    const now = performance.now();
    for (const die of dice) {
      const slot = this.idSlot.get(die.id);
      if (slot == null) continue;
      const position = this.layout.positions.get(die.id);
      if (position) {
        this.slots[slot].x = position.x;
        this.slots[slot].y = position.y;
      }
    }
    this.prev = this.synced && this.lastState ? this.snapshots(this.lastState) : [];
    this.updatePlateGeometry();
    this.updatePlateHighlights();
    this.fitCamera();
    this.writeStaticMatrices(now);
  }

  private fitCamera(): void {
    const bounds = this.layout.bounds;
    const contentWidth = Math.max(bounds.maxX - bounds.minX, 1) + config.renderer.cameraPadding * 2;
    const contentHeight = Math.max(bounds.maxY - bounds.minY, 1) + config.renderer.cameraPadding * 2;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    const aspect = width / height;

    let halfWidth: number;
    let halfHeight: number;
    if (contentWidth / contentHeight > aspect) {
      halfWidth = contentWidth / 2;
      halfHeight = halfWidth / aspect;
    } else {
      halfHeight = contentHeight / 2;
      halfWidth = halfHeight * aspect;
    }

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.position.set(centerX, centerY, 10);
    this.camera.lookAt(centerX, centerY, 0);
    this.camera.updateProjectionMatrix();
  }

  sync(state: GameState): void {
    if (!this.ready) {
      this.lastState = state;
      return;
    }
    const isInitial = !this.synced;
    this.synced = true;
    const dragId = this.dragId;
    const dragSolo = this.dragSolo;
    const dragCursor = this.dragCursor;
    this.captureDragForReset();
    this.finalizeAnimation();
    this.hasDice = state.dice.length > 0;

    const layoutChanged = isInitial || this.layoutChanged(this.lastState?.dice ?? [], state.dice);
    this.lastState = state;
    this.groupsByValue = groupDice(state.dice);

    if (layoutChanged) {
      this.layout = layout(state.dice, this.maxPerRow, this.aspect);
      const next = this.snapshots(state);
      const transitions = computeTransitions(this.prev, next);
      this.prev = next;
      this.updatePlateGeometry();
      this.fitCamera();
      if (isInitial) {
        this.populateInitial(state);
      } else if (transitions.length > 0) {
        this.animate(transitions, true);
      }
    }

    const selectionChanged = this.reconcileSelection(state);

    if (selectionChanged && !layoutChanged && !isInitial && this.selected.size > 0) {
      vibrate('select');
    }

    const now = performance.now();
    this.writeStaticMatrices(now);
    this.applyShake(now);

    this.applyGrabbedScale();
    this.updatePlateHighlights();
    this.resetPendingDrag();

    if (dragId) {
      const slot = this.idSlot.get(dragId);
      if (slot != null && !this.tweenIds.has(dragId)) {
        this.dragSolo = dragSolo;
        this.beginDrag(dragId);
        this.dragCursor = dragCursor;
        this.applyDragPositions();
        this.applyGrabbedScale();
      }
    }

    if (this.shakeActive) this.ensureLoop();
    this.render();
  }

  private populateInitial(state: GameState): void {
    for (const die of state.dice) {
      const position = this.layout.positions.get(die.id);
      const slot = this.allocateSlot(die.id, die.value, position?.x ?? 0, position?.y ?? 0);
      this.slots[slot].scale = 1;
    }
  }

  private layoutChanged(prev: Die[], next: Die[]): boolean {
    if (prev.length !== next.length) return true;
    for (let i = 0; i < prev.length; i++) {
      if (prev[i].id !== next[i].id || prev[i].value !== next[i].value || prev[i].origin !== next[i].origin) return true;
    }
    return false;
  }

  private snapshots(state: GameState): DieSnapshot[] {
    return state.dice.map((die) => {
      const position = this.layout.positions.get(die.id);
      return {
        id: die.id,
        value: die.value,
        x: position?.x ?? 0,
        y: position?.y ?? 0,
        origin: die.origin,
      };
    });
  }

  private allocateSlot(id: DiceId, value: number, x: number, y: number): number {
    let slot = this.freeSlots.pop();
    if (slot == null) {
      slot = this.slots.length;
      this.slots.push({ id, value, x, y, scale: 1, selected: false, shakePhase: Math.random() * Math.PI * 2, dying: false });
      this.ensureCapacity(this.slots.length);
      this.syncInstanceCount();
    } else {
      this.slots[slot] = { id, value, x, y, scale: 1, selected: false, shakePhase: Math.random() * Math.PI * 2, dying: false };
    }
    this.idSlot.set(id, slot);
    return slot;
  }

  private syncInstanceCount(): void {
    for (const mesh of this.instanced) mesh.count = this.slots.length;
  }

  private ensureCapacity(n: number): void {
    if (n <= this.capacity) return;
    this.capacity = Math.max(n, this.capacity * 2);
    this.rebuildInstanced();
    this.writeAllMatrices(performance.now());
  }

  private rebuildInstanced(): void {
    for (const mesh of this.instanced) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    this.instanced = [];
    for (const group of this.materialGroups) {
      const mesh = new THREE.InstancedMesh(group.geometry, group.material, Math.max(this.capacity, 1));
      mesh.count = this.slots.length;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.instanced.push(mesh);
      this.scene.add(mesh);
    }
    this.dirty = true;
  }

  private animate(transitions: Transition[], playAudio: boolean): void {
    if (playAudio) {
      const sounds = new Set<SoundName>();
      for (const transition of transitions) {
        if (transition.kind === 'appear') sounds.add('appear');
        else if (transition.kind === 'remove') sounds.add('disappear');
        else if (transition.kind === 'change' && (transition.origin === 'roll' || transition.origin === 'reroll'))
          sounds.add('roll');
      }
      for (const sound of sounds) playSound(sound);
    }

    const vibrations = new Set<VibrationName>();
    for (const transition of transitions) {
      if (transition.kind === 'appear') vibrations.add('add');
      else if (transition.kind === 'remove') vibrations.add('delete');
      else if (transition.kind === 'change' && (transition.origin === 'roll' || transition.origin === 'reroll'))
        vibrations.add('roll');
    }
    for (const vibration of vibrations) vibrate(vibration);

    const tweens: Tween[] = [];
    for (const transition of transitions) {
      if (transition.kind === 'appear') {
        const slot = this.allocateSlot(transition.id, transition.value, transition.x, transition.y);
        this.slots[slot].scale = 0;
        tweens.push({ kind: 'appear', id: transition.id });
      } else if (transition.kind === 'remove') {
        const slot = this.idSlot.get(transition.id);
        if (slot == null) continue;
        this.slots[slot].dying = true;
        tweens.push({ kind: 'remove', id: transition.id });
      } else if (transition.kind === 'slide') {
        const slot = this.idSlot.get(transition.id);
        if (slot == null) continue;
        const die = this.slots[slot];
        tweens.push({
          kind: 'slide',
          id: transition.id,
          fromX: die.x,
          fromY: die.y,
          toX: transition.toX,
          toY: transition.toY,
        });
      } else {
        let slot = this.idSlot.get(transition.id);
        if (slot == null) slot = this.allocateSlot(transition.id, transition.fromValue, transition.fromX, transition.fromY);
        const die = this.slots[slot];
        die.value = transition.fromValue;
        die.x = transition.fromX;
        die.y = transition.fromY;
        tweens.push({
          kind: 'change',
          id: transition.id,
          fromX: transition.fromX,
          fromY: transition.fromY,
          toX: transition.toX,
          toY: transition.toY,
          fromValue: transition.fromValue,
          toValue: transition.toValue,
          valueApplied: false,
          spin: transition.origin === 'roll' || transition.origin === 'reroll',
        });
      }
    }

    for (const tween of tweens) this.tweenIds.add(tween.id);
    this.tweens = tweens;
    this.tweenStart = performance.now();
    if (this.tweens.length > 0) this.ensureLoop();
  }

  private stepTweens(now: number): void {
    if (this.tweens.length === 0) return;
    const t = Math.min(1, (now - this.tweenStart) / config.renderer.animationDurationMs);
    const e = 1 - Math.pow(1 - t, 3);

    for (const tween of this.tweens) {
      const slot = this.idSlot.get(tween.id);
      if (slot == null) continue;
      const die = this.slots[slot];
      if (tween.kind === 'appear') {
        die.scale = e;
        this.writeMatrix(slot, now, e * Math.PI * 2, e * Math.PI * 2);
      } else if (tween.kind === 'remove') {
        die.scale = 1 - e;
        this.writeMatrix(slot, now);
      } else if (tween.kind === 'slide') {
        die.x = tween.fromX + (tween.toX - tween.fromX) * e;
        die.y = tween.fromY + (tween.toY - tween.fromY) * e;
        this.writeMatrix(slot, now);
      } else {
        die.x = tween.fromX + (tween.toX - tween.fromX) * e;
        die.y = tween.fromY + (tween.toY - tween.fromY) * e;
        if (tween.spin) this.writeMatrix(slot, now, e * Math.PI * 2, e * Math.PI * 2);
        else this.writeMatrix(slot, now);
        if (!tween.valueApplied && t >= 0.5) {
          die.value = tween.toValue;
          tween.valueApplied = true;
        }
      }
    }

    if (t >= 1) this.finalizeAnimation();
  }

  private finalizeAnimation(): void {
    const now = performance.now();
    for (const tween of this.tweens) {
      const slot = this.idSlot.get(tween.id);
      if (tween.kind === 'appear') {
        if (slot == null) continue;
        this.slots[slot].scale = 1;
        this.writeMatrix(slot, now);
      } else if (tween.kind === 'remove') {
        if (slot == null) continue;
        const die = this.slots[slot];
        die.scale = 0;
        die.dying = false;
        die.selected = false;
        this.idSlot.delete(tween.id);
        this.freeSlots.push(slot);
        this.writeMatrix(slot, now);
      } else if (tween.kind === 'slide') {
        if (slot == null) continue;
        const die = this.slots[slot];
        die.x = tween.toX;
        die.y = tween.toY;
        this.writeMatrix(slot, now);
      } else {
        if (slot == null) continue;
        const die = this.slots[slot];
        die.x = tween.toX;
        die.y = tween.toY;
        die.value = tween.toValue;
        die.scale = 1;
        this.writeMatrix(slot, now);
      }
    }
    this.tweens = [];
    this.tweenIds.clear();
  }

  private reconcileSelection(state: GameState): boolean {
    const prev = this.selected;
    const next = new Set<DiceId>();
    for (const die of state.dice) {
      const slot = this.idSlot.get(die.id);
      if (slot == null) continue;
      const isSelected = isDieSelected(die, state.selection);
      this.slots[slot].selected = isSelected;
      if (isSelected) next.add(die.id);
    }
    const changed = prev.size !== next.size || ![...prev].every((id) => next.has(id));
    this.selected = next;
    if (changed) {
      if (prev.size === 0 && next.size > 0) this.selectionSince = performance.now();
      else if (next.size === 0) {
        this.selectionSince = null;
        this.shakeActive = false;
      }
    }
    return changed;
  }

  private writeStaticMatrices(now: number): void {
    for (let i = 0; i < this.slots.length; i++) {
      const die = this.slots[i];
      if (this.idSlot.get(die.id) !== i) continue;
      if (die.selected || this.tweenIds.has(die.id)) continue;
      this.writeMatrix(i, now);
    }
  }

  private writeAllMatrices(now: number): void {
    for (let i = 0; i < this.slots.length; i++) this.writeMatrix(i, now);
  }

  private applyShake(now: number): void {
    const duration = config.renderer.shake.durationMs;
    const shaking =
      this.selected.size > 0 &&
      this.selectionSince != null &&
      (duration <= 0 || now - this.selectionSince < duration);

    if (shaking || shaking !== this.shakeActive) {
      this.shakeActive = shaking;
      for (const id of this.selected) {
        const slot = this.idSlot.get(id);
        if (slot == null || this.tweenIds.has(id)) continue;
        this.writeMatrix(slot, now);
      }
    }
  }

  private writeMatrix(slot: number, now: number, spinX = 0, spinY = 0): void {
    const die = this.slots[slot];
    const face = this.faceQuats[die.value] ?? this.qIdentity;
    this.pos.set(die.x, die.y, 0);

    let orientation = face;
    if (spinX !== 0 || spinY !== 0) {
      this.eul.set(spinX, spinY, 0);
      this.qA.setFromEuler(this.eul);
      this.qB.multiplyQuaternions(this.qA, face);
      orientation = this.qB;
    }
    if (die.selected && this.shakeActive) {
      const t = now / 1000;
      const shake = config.renderer.shake;
      const phase = die.shakePhase;
      const sx = Math.sin(t * shake.xFrequency + phase * shake.xPhaseShift) * shake.xAmplitude;
      const sz = Math.sin(t * shake.zFrequency + phase) * shake.zAmplitude;
      this.eul.set(sx, 0, sz);
      this.qA.setFromEuler(this.eul);
      this.qB.multiplyQuaternions(this.qA, orientation);
      orientation = this.qB;
    }

    const s = die.scale;
    this.scl.set(s, s, s);
    this.mat.compose(this.pos, orientation, this.scl);
    for (const mesh of this.instanced) mesh.setMatrixAt(slot, this.mat);
    this.dirty = true;
  }

  setDrag(drag: { id: DiceId; x: number; y: number; solo?: boolean; target?: number } | null): void {
    if (!drag) {
      this.endDrag();
      return;
    }
    const cursor = this.cursorWorld(drag.x, drag.y);
    if (!cursor) return;
    this.dragSolo = drag.solo ?? false;
    if (this.dragId !== drag.id) this.beginDrag(drag.id);
    this.dragCursor = { x: cursor.x, y: cursor.y };
    this.dragTarget = drag.target ?? null;
    this.applyDragPositions();
    this.updatePlateHighlights();
    this.render();
  }

  private beginDrag(id: DiceId): void {
    this.dragId = id;
    const group = this.dragGroupIds();
    const n = group.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const spacing = config.renderer.dragSpacing;
    const startX = -((cols - 1) / 2) * spacing;
    const startY = config.renderer.dragLift + ((Math.ceil(n / cols) - 1) / 2) * spacing;
    this.dragOffsets.clear();
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.dragOffsets.set(group[i], { x: startX + col * spacing, y: startY - row * spacing });
    }
    this.applyGrabbedScale();
  }

  private dragGroupIds(): DiceId[] {
    if (this.dragSolo) {
      return this.dragId ? [this.dragId] : [];
    }
    const ids: DiceId[] = [];
    for (const id of this.idSlot.keys()) {
      if (id === this.dragId || this.selected.has(id)) ids.push(id);
    }
    return ids;
  }

  private applyDragPositions(): void {
    if (!this.dragCursor) return;
    const now = performance.now();
    for (const [id, offset] of this.dragOffsets) {
      const slot = this.idSlot.get(id);
      if (slot == null) continue;
      const die = this.slots[slot];
      die.x = this.dragCursor.x + offset.x;
      die.y = this.dragCursor.y + offset.y;
      this.writeMatrix(slot, now);
    }
  }

  private endDrag(): void {
    const now = performance.now();
    for (const id of this.dragOffsets.keys()) {
      const slot = this.idSlot.get(id);
      const position = this.layout.positions.get(id);
      if (slot != null && position) {
        this.slots[slot].x = position.x;
        this.slots[slot].y = position.y;
        this.writeMatrix(slot, now);
      }
    }
    this.dragId = null;
    this.dragOffsets.clear();
    this.dragCursor = null;
    this.dragSolo = false;
    this.dragTarget = null;
    this.applyGrabbedScale();
    this.updatePlateHighlights();
    this.render();
  }

  private captureDragForReset(): void {
    for (const id of this.dragOffsets.keys()) this.pendingDragReset.add(id);
    this.dragId = null;
    this.dragOffsets.clear();
    this.dragCursor = null;
    this.dragSolo = false;
    this.dragTarget = null;
  }

  private resetPendingDrag(): void {
    const now = performance.now();
    for (const id of this.pendingDragReset) {
      const slot = this.idSlot.get(id);
      if (slot == null || this.tweenIds.has(id)) continue;
      const position = this.layout.positions.get(id);
      if (position) {
        this.slots[slot].x = position.x;
        this.slots[slot].y = position.y;
        this.writeMatrix(slot, now);
      }
    }
    this.pendingDragReset.clear();
  }

  private applyGrabbedScale(): void {
    const now = performance.now();
    for (let i = 0; i < this.slots.length; i++) {
      const die = this.slots[i];
      if (this.idSlot.get(die.id) !== i) continue;
      if (this.tweenIds.has(die.id)) continue;
      const target = this.dragOffsets.has(die.id) ? config.renderer.grabScale : 1;
      this.setDieScale(die.id, target, now);
    }
  }

  private setDieScale(id: DiceId, target: number, now: number): void {
    const slot = this.idSlot.get(id);
    if (slot == null) return;
    const die = this.slots[slot];
    if (die.scale === target) {
      this.scaleFades.delete(id);
      this.scaleTargets.set(id, target);
      return;
    }
    if (this.scaleTargets.get(id) === target) return;
    this.scaleTargets.set(id, target);
    this.scaleFades.set(id, { from: die.scale, start: now });
    this.ensureLoop();
  }

  private cursorWorld(clientX: number, clientY: number): { x: number; y: number } | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    if (!this.raycaster.ray.intersectPlane(this.planeZ, this.planeHit)) return null;
    return { x: this.planeHit.x, y: this.planeHit.y };
  }

  private ensureLoop(): void {
    if (this.rafId === null) this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
  if (this.sizeTween.active) {
    const t = Math.min(1, (now - this.sizeTween.tween.startTime) / this.sizeTween.tween.duration);
    this.currentSize.width = this.interpolate(this.sizeTween.tween.start.width, this.sizeTween.tween.end.width, t);
    this.currentSize.height = this.interpolate(this.sizeTween.tween.start.height, this.sizeTween.tween.end.height, t);
    this.renderer.setSize(this.currentSize.width, this.currentSize.height, false);
  }

  if (this.sizeTween.active) {
    const t = Math.min(1, (now - this.sizeTween.tween.startTime) / this.sizeTween.tween.duration);
    this.currentSize.width = this.interpolate(this.sizeTween.tween.start.width, this.sizeTween.tween.end.width, t);
    this.currentSize.height = this.interpolate(this.sizeTween.tween.start.height, this.sizeTween.tween.end.height, t);
    this.renderer.setSize(this.currentSize.width, this.currentSize.height, false);
  }
    this.stepTweens(now);
    this.applyShake(now);
    const fading = this.stepPlateFade(now);
    const scaling = this.stepScaleFade(now);
    this.render();

    const active = this.tweens.length > 0 || this.shakeActive || fading || scaling;
    this.rafId = active ? requestAnimationFrame(this.tick) : null;
  };

  render(): void {
    if (this.dirty) {
      for (const mesh of this.instanced) mesh.instanceMatrix.needsUpdate = true;
      this.dirty = false;
    }
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dieAt(clientX: number, clientY: number): DieHit | null {
    if (!this.hasDice || this.instanced.length === 0) return null;
    for (const mesh of this.instanced) mesh.boundingSphere = null;
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hits = this.raycaster.intersectObjects(this.instanced, false);
    if (hits.length === 0) return null;
    const instanceId = hits[0].instanceId;
    if (instanceId == null) return null;
    const die = this.slots[instanceId];
    if (!die || die.dying) return null;
    return { id: die.id, value: die.value };
  }

  groupAt(clientX: number, clientY: number): number | undefined {
    if (!this.hasDice) return undefined;
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    if (!this.raycaster.ray.intersectPlane(this.planeZ, this.planeHit)) return undefined;
    const target = this.planeHit;
    const halfWidth =
      (this.layout.bounds.maxX - this.layout.bounds.minX) / 2 +
      config.renderer.plate.horizontalPadding;
    if (target.x < -halfWidth || target.x > halfWidth) return undefined;
    for (const band of this.layout.bands) {
      if (target.y <= band.top && target.y >= band.bottom - config.layout.groupGap) return band.value;
    }
    return undefined;
  }

  private ndc(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.domElement.getBoundingClientRect();
    return this.ndcVec.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.finalizeAnimation();
    this.resizeObserver.disconnect();
    for (const mesh of this.instanced) mesh.dispose();
    this.pixelPass?.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function groupDice(dice: Die[]): Map<number, Die[]> {
  const groups = new Map<number, Die[]>();
  for (const die of dice) {
    const group = groups.get(die.value);
    if (group) group.push(die);
    else groups.set(die.value, [die]);
  }
  return groups;
}

function createRoundedRectGeometry(width: number, height: number, radius: number): THREE.ShapeGeometry {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.absarc(x + width - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + width, y + height - r);
  shape.absarc(x + width - r, y + height - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + height);
  shape.absarc(x + r, y + height - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return new THREE.ShapeGeometry(shape);
}
