import * as THREE from 'three';
import type { GameState } from '../core/game/state';
import type { DiceId, Die } from '../core/dice/types';
import { createD6Mesh, setD6Value, loadDiceModel, hasDiceModel } from './dice';
import { layout, type Layout } from './layout';
import { computeTransitions, controlsRotation, type DieSnapshot, type Transition } from './animator';
import type { DieHit } from '../input/hitTest';
import { config } from '../config';
import { playSound, type SoundName } from '../services/audio';
import { plateOpacity } from './plateOpacity';

type Tween =
  | { kind: 'appear'; mesh: THREE.Object3D }
  | { kind: 'remove'; mesh: THREE.Object3D }
  | { kind: 'slide'; mesh: THREE.Object3D; fromX: number; fromY: number; toX: number; toY: number }
  | {
      kind: 'change';
      mesh: THREE.Object3D;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      toValue: number;
      valueApplied: boolean;
      spin: boolean;
    };

export class DiceRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private raycaster = new THREE.Raycaster();
  private resizeObserver: ResizeObserver;
  private meshes = new Map<DiceId, THREE.Object3D>();
  private selected = new Set<THREE.Object3D>();
  private plates = new Map<number, THREE.Mesh>();
  private layout: Layout = { positions: new Map(), bands: [], bounds: { minX: -2, maxX: 2, minY: -1, maxY: 0 } };
  private lastState: GameState | null = null;
  private maxPerRow = 6;
  private prev: DieSnapshot[] = [];
  private tweens: Tween[] = [];
  private tweenMeshes = new Set<THREE.Object3D>();
  private tweenStart = 0;
  private rafId: number | null = null;
  private hasDice = false;
  private synced = false;
  private dragId: DiceId | null = null;
  private dragSolo = false;
  private dragOffsets = new Map<DiceId, { x: number; y: number }>();
  private dragCursor: { x: number; y: number } | null = null;
  private dragTarget: number | null = null;
  private pendingDragReset = new Set<DiceId>();
  private plateTargets = new Map<number, number>();
  private plateFades = new Map<number, { from: number; start: number }>();

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

    this.createPlates();

    loadDiceModel(config.assets.diceModel)
      .then(() => {
        if (this.lastState) this.sync(this.lastState);
      })
      .catch((error) => console.error('Failed to load dice model', error));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
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
    const group = (this.lastState?.dice ?? []).filter((d) => d.value === value);
    if (group.length === 0) {
      return this.groupHighlighted(value) ? plate.selectedOpacity : plate.opacity;
    }
    if (config.renderer.plate.gradient) {
      const selected = group.filter((d) => d.selected).length;
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
    const dice = this.lastState?.dice ?? [];
    const group = dice.filter((d) => d.value === value);
    if (group.length > 0) return group.every((d) => d.selected);
    const range = this.lastState?.selectedGroups;
    return range != null && value >= range.min && value <= range.max;
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
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
    for (const mesh of this.meshes.values()) {
      const position = this.layout.positions.get(mesh.userData.dieId as string);
      if (position) mesh.position.set(position.x, position.y, 0);
    }
    this.prev = this.synced && this.lastState ? this.snapshots(this.lastState) : [];
    this.updatePlateGeometry();
    this.updatePlateHighlights();
    this.fitCamera();
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
    if (!hasDiceModel()) {
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

    if (layoutChanged) {
      this.layout = layout(state.dice, this.maxPerRow, this.aspect);
      const next = this.snapshots(state);
      const transitions = computeTransitions(this.prev, next);
      this.prev = next;
      this.updatePlateGeometry();
      this.fitCamera();
      if (!isInitial && transitions.length > 0) this.animate(transitions, true);
    }

    this.selected.clear();
    for (const die of state.dice) {
      const mesh = this.ensureMesh(die.id, die.value);
      if (die.selected) this.selected.add(mesh);
    }

    if (isInitial) {
      for (const mesh of this.meshes.values()) {
        const position = this.layout.positions.get(mesh.userData.dieId as string);
        if (position) mesh.position.set(position.x, position.y, 0);
        mesh.scale.setScalar(1);
      }
    }

    for (const mesh of this.meshes.values()) {
      if (!this.selected.has(mesh) && !this.isRotationTweened(mesh)) {
        this.animTarget(mesh).rotation.set(0, 0, 0);
      }
    }

    this.applyGrabbedScale();
    this.updatePlateHighlights();
    this.resetPendingDrag();

    if (dragId) {
      const mesh = this.meshes.get(dragId);
      if (mesh && !this.tweenMeshes.has(mesh)) {
        this.dragSolo = dragSolo;
        this.beginDrag(dragId);
        this.dragCursor = dragCursor;
        this.applyDragPositions();
        this.applyGrabbedScale();
      }
    }

    if (this.selected.size > 0) this.ensureLoop();
    this.render();
  }

  private layoutChanged(prev: Die[], next: Die[]): boolean {
    if (prev.length !== next.length) return true;
    for (let i = 0; i < prev.length; i++) {
      if (
        prev[i].id !== next[i].id ||
        prev[i].value !== next[i].value ||
        prev[i].origin !== next[i].origin
      )
        return true;
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

  private ensureMesh(id: DiceId, value: number): THREE.Object3D {
    let mesh = this.meshes.get(id);
    if (!mesh) {
      mesh = createD6Mesh(value);
      mesh.userData.dieId = id;
      mesh.userData.value = value;
      mesh.userData.shakePhase = Math.random() * Math.PI * 2;
      this.meshes.set(id, mesh);
      this.scene.add(mesh);
    }
    return mesh;
  }

  private animTarget(mesh: THREE.Object3D): THREE.Object3D {
    return (mesh.userData.anim as THREE.Object3D) ?? mesh;
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

    const tweens: Tween[] = [];
    for (const transition of transitions) {
      if (transition.kind === 'appear') {
        const mesh = this.ensureMesh(transition.id, transition.value);
        mesh.position.set(transition.x, transition.y, 0);
        mesh.scale.setScalar(0);
        tweens.push({ kind: 'appear', mesh });
      } else if (transition.kind === 'remove') {
        const mesh = this.meshes.get(transition.id);
        if (mesh) tweens.push({ kind: 'remove', mesh });
      } else if (transition.kind === 'slide') {
        const mesh = this.meshes.get(transition.id);
        if (!mesh) continue;
        tweens.push({
          kind: 'slide',
          mesh,
          fromX: mesh.position.x,
          fromY: mesh.position.y,
          toX: transition.toX,
          toY: transition.toY,
        });
      } else {
        const mesh = this.ensureMesh(transition.id, transition.fromValue);
        setD6Value(mesh, transition.fromValue);
        tweens.push({
          kind: 'change',
          mesh,
          fromX: mesh.position.x,
          fromY: mesh.position.y,
          toX: transition.toX,
          toY: transition.toY,
          toValue: transition.toValue,
          valueApplied: false,
          spin: transition.origin === 'roll' || transition.origin === 'reroll',
        });
      }
    }

    for (const tween of tweens) this.tweenMeshes.add(tween.mesh);
    this.tweens = tweens;
    this.tweenStart = performance.now();
    this.ensureLoop();
  }

  private stepTweens(now: number): void {
    if (this.tweens.length === 0) return;
    const t = Math.min(1, (now - this.tweenStart) / config.renderer.animationDurationMs);
    const e = 1 - Math.pow(1 - t, 3);

    for (const tween of this.tweens) {
      if (tween.kind === 'appear') {
        tween.mesh.scale.setScalar(e);
        this.animTarget(tween.mesh).rotation.x = e * Math.PI * 2;
        this.animTarget(tween.mesh).rotation.y = e * Math.PI * 2;
      } else if (tween.kind === 'remove') {
        tween.mesh.scale.setScalar(1 - e);
      } else if (tween.kind === 'slide') {
        tween.mesh.position.x = tween.fromX + (tween.toX - tween.fromX) * e;
        tween.mesh.position.y = tween.fromY + (tween.toY - tween.fromY) * e;
      } else {
        tween.mesh.position.x = tween.fromX + (tween.toX - tween.fromX) * e;
        tween.mesh.position.y = tween.fromY + (tween.toY - tween.fromY) * e;
        if (tween.spin) {
          this.animTarget(tween.mesh).rotation.x = e * Math.PI * 2;
          this.animTarget(tween.mesh).rotation.y = e * Math.PI * 2;
        }
        if (!tween.valueApplied && t >= 0.5) {
          setD6Value(tween.mesh, tween.toValue);
          tween.valueApplied = true;
        }
      }
    }

    if (t >= 1) this.finalizeAnimation();
  }

  private finalizeAnimation(): void {
    for (const tween of this.tweens) {
      if (tween.kind === 'appear') {
        tween.mesh.scale.setScalar(1);
        this.animTarget(tween.mesh).rotation.set(0, 0, 0);
      } else if (tween.kind === 'remove') {
        this.scene.remove(tween.mesh);
        this.meshes.delete(tween.mesh.userData.dieId as string);
      } else if (tween.kind === 'slide') {
        tween.mesh.position.set(tween.toX, tween.toY, 0);
      } else {
        tween.mesh.position.set(tween.toX, tween.toY, 0);
        this.animTarget(tween.mesh).rotation.set(0, 0, 0);
        setD6Value(tween.mesh, tween.toValue);
        tween.mesh.userData.value = tween.toValue;
      }
    }
    this.tweens = [];
    this.tweenMeshes.clear();
  }

  private applyShake(now: number): void {
    if (this.selected.size === 0) return;
    const t = now / 1000;
    const shake = config.renderer.shake;
    for (const mesh of this.selected) {
      if (this.tweenMeshes.has(mesh)) continue;
      const phase = (mesh.userData.shakePhase as number) ?? 0;
      const anim = this.animTarget(mesh);
      anim.rotation.z = Math.sin(t * shake.zFrequency + phase) * shake.zAmplitude;
      anim.rotation.x = Math.sin(t * shake.xFrequency + phase * shake.xPhaseShift) * shake.xAmplitude;
    }
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
    for (const [id, mesh] of this.meshes) {
      if (id === this.dragId || this.selected.has(mesh)) ids.push(id);
    }
    return ids;
  }

  private applyDragPositions(): void {
    if (!this.dragCursor) return;
    for (const [id, mesh] of this.meshes) {
      const offset = this.dragOffsets.get(id);
      if (!offset) continue;
      mesh.position.x = this.dragCursor.x + offset.x;
      mesh.position.y = this.dragCursor.y + offset.y;
    }
  }

  private endDrag(): void {
    for (const id of this.dragOffsets.keys()) {
      const mesh = this.meshes.get(id);
      const position = this.layout.positions.get(id);
      if (mesh && position) mesh.position.set(position.x, position.y, 0);
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
    for (const id of this.pendingDragReset) {
      const mesh = this.meshes.get(id);
      if (!mesh || this.tweenMeshes.has(mesh)) continue;
      const position = this.layout.positions.get(id);
      if (position) mesh.position.set(position.x, position.y, 0);
    }
    this.pendingDragReset.clear();
  }

  private applyGrabbedScale(): void {
    for (const [id, mesh] of this.meshes) {
      if (this.isScaleTweened(mesh)) continue;
      mesh.scale.setScalar(this.dragOffsets.has(id) ? config.renderer.grabScale : 1);
    }
  }

  private isScaleTweened(mesh: THREE.Object3D): boolean {
    return this.tweens.some(
      (tween) => tween.mesh === mesh && (tween.kind === 'appear' || tween.kind === 'remove'),
    );
  }

  private isRotationTweened(mesh: THREE.Object3D): boolean {
    return this.tweens.some(
      (tween) => tween.mesh === mesh && controlsRotation(tween.kind, tween.kind === 'change' && tween.spin),
    );
  }

  private cursorWorld(clientX: number, clientY: number): { x: number; y: number } | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const target = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, target)) return null;
    return { x: target.x, y: target.y };
  }

  private ensureLoop(): void {
    if (this.rafId === null) this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.stepTweens(now);
    this.applyShake(now);
    const fading = this.stepPlateFade(now);
    this.render();

    const active = this.tweens.length > 0 || this.selected.size > 0 || fading;
    this.rafId = active ? requestAnimationFrame(this.tick) : null;
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dieAt(clientX: number, clientY: number): DieHit | null {
    if (!this.hasDice) return null;
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hits = this.raycaster.intersectObjects([...this.meshes.values()], true);
    if (hits.length === 0) return null;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !obj.userData.dieId) obj = obj.parent;
    if (!obj) return null;
    return { id: obj.userData.dieId as string, value: obj.userData.value as number };
  }

  groupAt(clientX: number, clientY: number): number | undefined {
    if (!this.hasDice) return undefined;
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const target = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, target)) return undefined;
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
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.finalizeAnimation();
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
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
