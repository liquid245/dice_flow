import * as THREE from 'three';
import type { GameState } from '../core/game/state';
import type { DiceId } from '../core/dice/types';
import { createD6Mesh } from './dice';
import { layoutPositions, valueFromY } from './layout';
import type { DieHit } from '../input/hitTest';

export class DiceRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private raycaster = new THREE.Raycaster();
  private resizeObserver: ResizeObserver;
  private meshes = new Map<DiceId, THREE.Mesh>();
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

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    const halfHeight = 7;
    const halfWidth = halfHeight * (width / height);
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  sync(state: GameState): void {
    this.hasDice = state.dice.length > 0;
    const positions = layoutPositions(state.dice);
    const seen = new Set<DiceId>();

    for (const die of state.dice) {
      seen.add(die.id);
      let mesh = this.meshes.get(die.id);
      if (!mesh) {
        mesh = createD6Mesh();
        mesh.userData.dieId = die.id;
        this.meshes.set(die.id, mesh);
        this.scene.add(mesh);
      }
      mesh.userData.value = die.value;
      const position = positions.get(die.id);
      if (position) mesh.position.set(position.x, position.y, position.z);
      this.applySelection(mesh, die.selected);
    }

    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        this.meshes.delete(id);
      }
    }
  }

  private applySelection(mesh: THREE.Mesh, selected: boolean): void {
    const materials = mesh.material as THREE.MeshStandardMaterial[];
    for (const material of materials) {
      material.emissive.setHex(selected ? 0x661111 : 0x000000);
    }
    mesh.scale.setScalar(selected ? 1.12 : 1);
  }

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
    return valueFromY(target.y);
  }

  private ndc(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
