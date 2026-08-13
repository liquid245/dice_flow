import * as THREE from 'three';
import type { GameState } from '../core/game/state';
import type { DiceId } from '../core/dice/types';
import { createD6Mesh, setD6Value } from './dice';
import { layout, GROUP_GAP, type Layout } from './layout';
import { computeTransitions, type DieSnapshot, type Transition } from './animator';
import type { DieHit } from '../input/hitTest';

const ANIMATION_DURATION_MS = 400;
const CAMERA_PADDING = 1.0;
const MIN_PER_ROW = 4;
const MAX_PER_ROW = 10;

type Tween =
  | { kind: 'appear'; mesh: THREE.Mesh }
  | { kind: 'remove'; mesh: THREE.Mesh }
  | { kind: 'slide'; mesh: THREE.Mesh; fromX: number; fromY: number; toX: number; toY: number }
  | {
      kind: 'change';
      mesh: THREE.Mesh;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      toValue: number;
      valueApplied: boolean;
    };

export class DiceRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private raycaster = new THREE.Raycaster();
  private resizeObserver: ResizeObserver;
  private meshes = new Map<DiceId, THREE.Mesh>();
  private selected = new Set<THREE.Mesh>();
  private plates = new Map<number, THREE.Mesh>();
  private layout: Layout = { positions: new Map(), bands: [], bounds: { minX: -2, maxX: 2, minY: -1, maxY: 0 } };
  private lastState: GameState | null = null;
  private maxPerRow = 6;
  private prev: DieSnapshot[] = [];
  private tweens: Tween[] = [];
  private tweenMeshes = new Set<THREE.Mesh>();
  private tweenStart = 0;
  private rafId: number | null = null;
  private hasDice = false;

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

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(5, 5, 10);
    this.scene.add(key);

    this.createPlates();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private createPlates(): void {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    for (let value = 6; value >= 1; value--) {
      const plate = new THREE.Mesh(geometry, material);
      plate.position.z = -0.5;
      this.plates.set(value, plate);
      this.scene.add(plate);
    }
  }

  private updatePlates(): void {
    const width = this.layout.bounds.maxX - this.layout.bounds.minX + 0.8;
    for (const band of this.layout.bands) {
      const plate = this.plates.get(band.value);
      if (!plate) continue;
      plate.scale.set(width, band.top - band.bottom, 1);
      plate.position.set(0, (band.top + band.bottom) / 2, -0.5);
    }
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.maxPerRow = this.computeMaxPerRow(width / height);
    this.relayout();
    this.render();
  }

  private computeMaxPerRow(aspect: number): number {
    return Math.max(MIN_PER_ROW, Math.min(MAX_PER_ROW, Math.round(6 * aspect)));
  }

  private relayout(): void {
    const dice = this.lastState ? this.lastState.dice : [];
    this.layout = layout(dice, this.maxPerRow);
    for (const mesh of this.meshes.values()) {
      const position = this.layout.positions.get(mesh.userData.dieId as string);
      if (position) mesh.position.set(position.x, position.y, 0);
    }
    this.prev = this.lastState ? this.snapshots(this.lastState) : [];
    this.updatePlates();
    this.fitCamera();
  }

  private fitCamera(): void {
    const bounds = this.layout.bounds;
    const contentWidth = Math.max(bounds.maxX - bounds.minX, 1) + CAMERA_PADDING * 2;
    const contentHeight = Math.max(bounds.maxY - bounds.minY, 1) + CAMERA_PADDING * 2;
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
    this.finalizeAnimation();
    this.hasDice = state.dice.length > 0;
    this.lastState = state;
    this.layout = layout(state.dice, this.maxPerRow);

    const next = this.snapshots(state);
    const transitions = computeTransitions(this.prev, next);
    this.prev = next;

    this.selected.clear();
    for (const die of state.dice) {
      const mesh = this.ensureMesh(die.id, die.value);
      if (die.selected) this.selected.add(mesh);
    }

    for (const mesh of this.meshes.values()) {
      if (!this.selected.has(mesh) && !this.tweenMeshes.has(mesh)) {
        mesh.rotation.set(0, 0, 0);
      }
    }

    this.updatePlates();
    this.fitCamera();

    if (transitions.length > 0) this.animate(transitions);
    if (this.selected.size > 0) this.ensureLoop();
    this.render();
  }

  private snapshots(state: GameState): DieSnapshot[] {
    return state.dice.map((die) => {
      const position = this.layout.positions.get(die.id);
      return {
        id: die.id,
        value: die.value,
        x: position?.x ?? 0,
        y: position?.y ?? 0,
      };
    });
  }

  private ensureMesh(id: DiceId, value: number): THREE.Mesh {
    let mesh = this.meshes.get(id);
    if (!mesh) {
      mesh = createD6Mesh(value);
      mesh.userData.dieId = id;
      mesh.userData.value = value;
      this.meshes.set(id, mesh);
      this.scene.add(mesh);
    }
    return mesh;
  }

  private animate(transitions: Transition[]): void {
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
        mesh.position.set(transition.fromX, transition.fromY, 0);
        tweens.push({
          kind: 'slide',
          mesh,
          fromX: transition.fromX,
          fromY: transition.fromY,
          toX: transition.toX,
          toY: transition.toY,
        });
      } else {
        const mesh = this.ensureMesh(transition.id, transition.fromValue);
        setD6Value(mesh, transition.fromValue);
        mesh.position.set(transition.fromX, transition.fromY, 0);
        tweens.push({
          kind: 'change',
          mesh,
          fromX: transition.fromX,
          fromY: transition.fromY,
          toX: transition.toX,
          toY: transition.toY,
          toValue: transition.toValue,
          valueApplied: false,
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
    const t = Math.min(1, (now - this.tweenStart) / ANIMATION_DURATION_MS);
    const e = 1 - Math.pow(1 - t, 3);

    for (const tween of this.tweens) {
      if (tween.kind === 'appear') {
        tween.mesh.scale.setScalar(e);
        tween.mesh.rotation.x = e * Math.PI * 2;
        tween.mesh.rotation.y = e * Math.PI * 2;
      } else if (tween.kind === 'remove') {
        tween.mesh.scale.setScalar(1 - e);
      } else if (tween.kind === 'slide') {
        tween.mesh.position.x = tween.fromX + (tween.toX - tween.fromX) * e;
        tween.mesh.position.y = tween.fromY + (tween.toY - tween.fromY) * e;
      } else {
        tween.mesh.position.x = tween.fromX + (tween.toX - tween.fromX) * e;
        tween.mesh.position.y = tween.fromY + (tween.toY - tween.fromY) * e;
        tween.mesh.rotation.x = e * Math.PI * 2;
        tween.mesh.rotation.y = e * Math.PI * 2;
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
        tween.mesh.rotation.set(0, 0, 0);
      } else if (tween.kind === 'remove') {
        this.scene.remove(tween.mesh);
        this.meshes.delete(tween.mesh.userData.dieId as string);
      } else if (tween.kind === 'slide') {
        tween.mesh.position.set(tween.toX, tween.toY, 0);
      } else {
        tween.mesh.position.set(tween.toX, tween.toY, 0);
        tween.mesh.rotation.set(0, 0, 0);
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
    for (const mesh of this.selected) {
      if (this.tweenMeshes.has(mesh)) continue;
      mesh.rotation.z = Math.sin(t * 55) * 0.08;
      mesh.rotation.x = Math.sin(t * 41) * 0.05;
    }
  }

  private ensureLoop(): void {
    if (this.rafId === null) this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.stepTweens(now);
    this.applyShake(now);
    this.render();

    const active = this.tweens.length > 0 || this.selected.size > 0;
    this.rafId = active ? requestAnimationFrame(this.tick) : null;
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dieAt(clientX: number, clientY: number): DieHit | null {
    if (!this.hasDice) return null;
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hits = this.raycaster.intersectObjects([...this.meshes.values()], false);
    if (hits.length === 0) return null;
    const mesh = hits[0].object as THREE.Mesh;
    return { id: mesh.userData.dieId as string, value: mesh.userData.value as number };
  }

  groupAt(clientX: number, clientY: number): number | undefined {
    if (!this.hasDice) return undefined;
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const target = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, target)) return undefined;
    for (const band of this.layout.bands) {
      if (target.y <= band.top && target.y >= band.bottom - GROUP_GAP) return band.value;
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
