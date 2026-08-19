import * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import type { GameState } from '../core/game/state';
import type { DiceId, Die } from '../core/dice/types';
import { isDieSelected } from '../core/selection/selection';
import { loadDiceModel, type LodGroup } from './dice';
import { layout, type Layout } from './layout';
import { computeTransitions, type DieSnapshot, type Transition } from './animator';
import { startMotion, motionValue, motionProgress, motionDone, type Motion } from './motion';
import type { DieHit } from '../input/hitTest';
import { config } from '../config';
import { playSound, type SoundName } from '../services/audio';
import { vibrate, type VibrationName } from '../services/vibration';
import { plateOpacity } from './plateOpacity';

interface DieInstance {
  id: DiceId;
  value: number;
  x: number;
  y: number;
  scale: number;
  selected: boolean;
  shakePhase: number;
  dying: boolean;
  spin: number;
  tx: number;
  ty: number;
  tscale: number;
  tvalue: number;
  mx: Motion | null;
  my: Motion | null;
  mscale: Motion | null;
  mspin: Motion | null;
  mvalue: Motion | null;
}

const DEFAULT_CAPACITY = 512;

export class DiceRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private composer: EffectComposer | null = null;
  private pixelPass: RenderPixelatedPass | null = null;
  private raycaster = new THREE.Raycaster();
  private resizeObserver: ResizeObserver;
  private materialGroups: LodGroup[] = [];
  private instanced: THREE.InstancedMesh[] = [];
  private capacity = DEFAULT_CAPACITY;
  private ready = false;

  private slots: DieInstance[] = [];
  private idSlot = new Map<DiceId, number>();
  private freeSlots: number[] = [];
  private selected = new Set<DiceId>();
  private shakeActive = false;
  private groupsByValue = new Map<number, Die[]>();

  private plates = new Map<number, THREE.Mesh>();
  private layout: Layout = { positions: new Map(), bands: [], bounds: { minX: -2, maxX: 2, minY: -1, maxY: 0 } };
  private lastState: GameState | null = null;
  private maxPerRow = 6;
  private prev: DieSnapshot[] = [];
  private rafId: number | null = null;
  private hasDice = false;
  private synced = false;
  private dirty = false;

  private dragId: DiceId | null = null;
  private dragSolo = false;
  private dragOffsets = new Map<DiceId, { x: number; y: number }>();
  private dragTarget: number | null = null;

  private plateTargets = new Map<number, number>();
  private plateFades = new Map<number, { from: number; start: number }>();

  private cameraAnimating = false;
  private cameraStart = 0;
  private cameraFrom = { halfWidth: 1, halfHeight: 1, centerX: 0, centerY: 0 };
  private cameraTo = { halfWidth: 1, halfHeight: 1, centerX: 0, centerY: 0 };

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
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
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
      if (this.dragOffsets.has(die.id)) continue;
      const position = this.layout.positions.get(die.id);
      if (!position) continue;
      this.setTarget(die.id, { x: position.x, y: position.y });
    }
    this.prev = this.synced && this.lastState ? this.snapshots(this.lastState) : [];
    this.updatePlateGeometry();
    this.updatePlateHighlights();
    this.fitCamera(false);
    this.writeIdleMatrices(now);
  }

  private fitCamera(animated: boolean): void {
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

    const target = { halfWidth, halfHeight, centerX, centerY };
    const near =
      Math.abs(target.halfWidth - this.cameraTo.halfWidth) < 0.0001 &&
      Math.abs(target.halfHeight - this.cameraTo.halfHeight) < 0.0001 &&
      Math.abs(target.centerX - this.cameraTo.centerX) < 0.0001 &&
      Math.abs(target.centerY - this.cameraTo.centerY) < 0.0001;
    if (!animated || near) {
      this.cameraTo = target;
      this.applyCamera(target);
      this.cameraAnimating = false;
      return;
    }
    this.cameraFrom = { ...this.cameraTo };
    this.cameraTo = target;
    this.cameraStart = performance.now();
    this.cameraAnimating = true;
    this.ensureLoop();
  }

  private applyCamera(c: { halfWidth: number; halfHeight: number; centerX: number; centerY: number }): void {
    this.camera.left = -c.halfWidth;
    this.camera.right = c.halfWidth;
    this.camera.top = c.halfHeight;
    this.camera.bottom = -c.halfHeight;
    this.camera.position.set(c.centerX, c.centerY, 10);
    this.camera.lookAt(c.centerX, c.centerY, 0);
    this.camera.updateProjectionMatrix();
  }

  private stepCamera(now: number): boolean {
    if (!this.cameraAnimating) return false;
    const t = Math.min(1, (now - this.cameraStart) / config.renderer.animationDurationMs);
    const e = 1 - Math.pow(1 - t, 3);
    const c = {
      halfWidth: this.cameraFrom.halfWidth + (this.cameraTo.halfWidth - this.cameraFrom.halfWidth) * e,
      halfHeight: this.cameraFrom.halfHeight + (this.cameraTo.halfHeight - this.cameraFrom.halfHeight) * e,
      centerX: this.cameraFrom.centerX + (this.cameraTo.centerX - this.cameraFrom.centerX) * e,
      centerY: this.cameraFrom.centerY + (this.cameraTo.centerY - this.cameraFrom.centerY) * e,
    };
    this.applyCamera(c);
    if (t >= 1) {
      this.applyCamera(this.cameraTo);
      this.cameraAnimating = false;
      return false;
    }
    return true;
  }

  sync(state: GameState): void {
    if (!this.ready) {
      this.lastState = state;
      return;
    }
    const isInitial = !this.synced;
    this.synced = true;
    this.hasDice = state.dice.length > 0;

    const layoutChanged = isInitial || this.layoutChanged(this.lastState?.dice ?? [], state.dice);
    this.lastState = state;
    this.groupsByValue = groupDice(state.dice);

    if (layoutChanged) {
      this.layout = layout(state.dice, this.maxPerRow, this.aspect);
      this.updatePlateGeometry();
      this.fitCamera(!isInitial);
    }

    const selectionChanged = this.reconcileSelection(state);

    const now = performance.now();
    if (isInitial) {
      this.populateInitial(state);
      this.prev = this.snapshots(state);
      this.writeAllMatrices(now);
    } else {
      this.applyStateTransitions(state, layoutChanged);
    }

    if (selectionChanged && !layoutChanged && !isInitial && this.selected.size > 0) {
      vibrate('select');
    }

    if (this.dragId != null && this.idSlot.get(this.dragId) == null) {
      this.endDrag();
    }

    this.writeIdleMatrices(now);
    this.applyShake(now);
    this.updatePlateHighlights();
    this.render();
  }

  private populateInitial(state: GameState): void {
    for (const die of state.dice) {
      const position = this.layout.positions.get(die.id);
      this.allocateSlot(die.id, die.value, position?.x ?? 0, position?.y ?? 0);
    }
  }

  private applyStateTransitions(state: GameState, layoutChanged: boolean): void {
    const sounds = new Set<SoundName>();
    const vibrations = new Set<VibrationName>();
    if (layoutChanged) {
      const next = this.snapshots(state);
      const transitions = computeTransitions(this.prev, next);
      this.prev = next;
      for (const transition of transitions) {
        this.applyTransition(transition, sounds, vibrations);
      }
    }
    for (const sound of sounds) playSound(sound);
    for (const vibration of vibrations) vibrate(vibration);

    for (const die of state.dice) {
      if (this.dragOffsets.has(die.id)) continue;
      const position = this.layout.positions.get(die.id);
      if (!position) continue;
      this.setTarget(die.id, { x: position.x, y: position.y, scale: 1 });
    }
  }

  private applyTransition(
    transition: Transition,
    sounds: Set<SoundName>,
    vibrations: Set<VibrationName>,
  ): void {
    if (transition.kind === 'appear') {
      sounds.add('appear');
      vibrations.add('add');
      this.spawnDie(transition.id, transition.value, transition.x, transition.y);
    } else if (transition.kind === 'remove') {
      sounds.add('disappear');
      vibrations.add('delete');
      this.removeDie(transition.id);
    } else if (transition.kind === 'change') {
      const spin = transition.origin === 'roll' || transition.origin === 'reroll';
      if (spin) {
        sounds.add('roll');
        vibrations.add('roll');
      }
      this.setTarget(transition.id, {
        x: transition.toX,
        y: transition.toY,
        value: transition.toValue,
        spin,
      });
    } else {
      this.setTarget(transition.id, { x: transition.toX, y: transition.toY });
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
    const existingSlot = this.idSlot.get(id);
    if (existingSlot != null && this.slots[existingSlot]?.dying) {
      this.freeSlot(existingSlot, this.slots[existingSlot]);
    }
    const instance: DieInstance = {
      id,
      value,
      x,
      y,
      scale: 1,
      selected: false,
      shakePhase: Math.random() * Math.PI * 2,
      dying: false,
      spin: 0,
      tx: x,
      ty: y,
      tscale: 1,
      tvalue: value,
      mx: null,
      my: null,
      mscale: null,
      mspin: null,
      mvalue: null,
    };
    let slot = this.freeSlots.pop();
    if (slot == null) {
      slot = this.slots.length;
      this.slots.push(instance);
      this.ensureCapacity(this.slots.length);
      this.syncInstanceCount();
    } else {
      this.slots[slot] = instance;
    }
    this.idSlot.set(id, slot);
    return slot;
  }

  private spawnDie(id: DiceId, value: number, x: number, y: number): void {
    const slot = this.allocateSlot(id, value, x, y);
    const die = this.slots[slot];
    const now = performance.now();
    die.scale = 0;
    die.mscale = startMotion(0, 1, now, config.renderer.animationDurationMs);
    die.mspin = startMotion(0, Math.PI * 2, now, config.renderer.animationDurationMs);
    this.ensureLoop();
  }

  private removeDie(id: DiceId): void {
    const slot = this.idSlot.get(id);
    if (slot == null) return;
    const die = this.slots[slot];
    die.dying = true;
    die.tscale = 0;
    die.mscale = startMotion(die.scale, 0, performance.now(), config.renderer.animationDurationMs);
    this.ensureLoop();
  }

  private freeSlot(slot: number, die: DieInstance): void {
    die.scale = 0;
    die.dying = false;
    die.selected = false;
    this.idSlot.delete(die.id);
    this.freeSlots.push(slot);
    this.writeMatrix(slot, performance.now());
  }

  private setTarget(
    id: DiceId,
    patch: { x?: number; y?: number; scale?: number; value?: number; spin?: boolean },
  ): void {
    const slot = this.idSlot.get(id);
    if (slot == null) return;
    const die = this.slots[slot];
    if (die.dying) return;
    const now = performance.now();
    if (patch.x !== undefined && patch.x !== die.tx) {
      die.tx = patch.x;
      die.mx = startMotion(die.x, die.tx, now, config.renderer.animationDurationMs);
    }
    if (patch.y !== undefined && patch.y !== die.ty) {
      die.ty = patch.y;
      die.my = startMotion(die.y, die.ty, now, config.renderer.animationDurationMs);
    }
    if (patch.scale !== undefined && patch.scale !== die.tscale) {
      die.tscale = patch.scale;
      die.mscale = startMotion(die.scale, die.tscale, now, config.renderer.grabAnimMs);
    }
    if (patch.value !== undefined && patch.value !== die.tvalue) {
      die.tvalue = patch.value;
      if (die.value !== die.tvalue) {
        die.mvalue = startMotion(0, 1, now, config.renderer.animationDurationMs);
      }
    }
    if (patch.spin) {
      die.mspin = startMotion(die.spin, Math.PI * 2, now, config.renderer.animationDurationMs);
    }
    this.ensureLoop();
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
      this.shakeActive = next.size > 0;
    }
    return changed;
  }

  private writeIdleMatrices(now: number): void {
    for (let i = 0; i < this.slots.length; i++) {
      const die = this.slots[i];
      if (this.idSlot.get(die.id) !== i) continue;
      if (die.mx || die.my || die.mscale || die.mspin || die.mvalue) continue;
      this.writeMatrix(i, now);
    }
  }

  private writeAllMatrices(now: number): void {
    for (let i = 0; i < this.slots.length; i++) this.writeMatrix(i, now);
  }

  private applyShake(now: number): void {
    if (!this.shakeActive) return;
    this.ensureLoop();
    for (const id of this.selected) {
      const slot = this.idSlot.get(id);
      if (slot == null) continue;
      this.writeMatrix(slot, now);
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
    this.dragTarget = drag.target ?? null;
    for (const [id, offset] of this.dragOffsets) {
      this.dragFollow(id, cursor.x + offset.x, cursor.y + offset.y);
    }
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
      const offset = { x: startX + col * spacing, y: startY - row * spacing };
      this.dragOffsets.set(group[i], offset);
      this.setTarget(group[i], { scale: config.renderer.grabScale });
    }
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

  private dragFollow(id: DiceId, x: number, y: number): void {
    const slot = this.idSlot.get(id);
    if (slot == null) return;
    const die = this.slots[slot];
    if (die.dying) return;
    const now = performance.now();
    die.tx = x;
    die.ty = y;
    die.mx = startMotion(die.x, x, now, config.renderer.dragFollowMs);
    die.my = startMotion(die.y, y, now, config.renderer.dragFollowMs);
    this.ensureLoop();
  }

  private endDrag(): void {
    const ids = [...this.dragOffsets.keys()];
    this.dragId = null;
    this.dragOffsets.clear();
    this.dragSolo = false;
    this.dragTarget = null;
    for (const id of ids) {
      const position = this.layout.positions.get(id);
      if (position) this.setTarget(id, { x: position.x, y: position.y, scale: 1 });
      else this.setTarget(id, { scale: 1 });
    }
    this.updatePlateHighlights();
    this.render();
  }

  private cursorWorld(clientX: number, clientY: number): { x: number; y: number } | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    if (!this.raycaster.ray.intersectPlane(this.planeZ, this.planeHit)) return null;
    return { x: this.planeHit.x, y: this.planeHit.y };
  }

  private ensureLoop(): void {
    if (this.rafId === null) this.rafId = requestAnimationFrame(this.tick);
  }

  private advanceDiceMotions(now: number): boolean {
    let active = false;
    for (let i = 0; i < this.slots.length; i++) {
      const die = this.slots[i];
      if (this.idSlot.get(die.id) !== i) continue;
      const moving = !!(die.mx || die.my || die.mscale || die.mspin || die.mvalue);
      if (moving) {
        this.advanceDie(die, now);
        this.writeMatrix(i, now, die.spin, die.spin);
      }
      if (die.mx || die.my || die.mscale || die.mspin || die.mvalue) active = true;
      if (die.dying && !die.mscale && die.scale <= 0) this.freeSlot(i, die);
    }
    return active;
  }

  private advanceDie(die: DieInstance, now: number): void {
    if (die.mx) {
      if (motionDone(die.mx, now)) {
        die.x = die.mx.to;
        die.mx = null;
      } else {
        die.x = motionValue(die.mx, now);
      }
    }
    if (die.my) {
      if (motionDone(die.my, now)) {
        die.y = die.my.to;
        die.my = null;
      } else {
        die.y = motionValue(die.my, now);
      }
    }
    if (die.mscale) {
      if (motionDone(die.mscale, now)) {
        die.scale = die.mscale.to;
        die.mscale = null;
      } else {
        die.scale = motionValue(die.mscale, now);
      }
    }
    if (die.mspin) {
      if (motionDone(die.mspin, now)) {
        die.spin = 0;
        die.mspin = null;
      } else {
        die.spin = motionValue(die.mspin, now);
      }
    }
    if (die.mvalue) {
      const p = motionProgress(die.mvalue, now);
      if (die.value !== die.tvalue && p >= 0.5) die.value = die.tvalue;
      if (motionDone(die.mvalue, now)) die.mvalue = null;
    }
  }

  private tick = (now: number) => {
    const motion = this.advanceDiceMotions(now);
    this.applyShake(now);
    const camera = this.stepCamera(now);
    const fading = this.stepPlateFade(now);
    this.render();

    const active = motion || this.shakeActive || fading || camera;
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
