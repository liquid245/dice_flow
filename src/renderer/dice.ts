import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { config } from '../config';

let template: THREE.Object3D | null = null;

export async function loadDiceModel(url: string): Promise<void> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = gltf.scene;
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  scene.scale.setScalar(config.layout.dieSize / maxDim);
  template = scene;
}

export function hasDiceModel(): boolean {
  return template !== null;
}

export function createD6Mesh(value: number): THREE.Object3D {
  if (!template) throw new Error('dice model not loaded');
  const root = new THREE.Group();
  const model = template.clone(true);
  root.add(model);
  root.userData.anim = model;
  root.userData.value = value;
  setD6Value(root, value);
  return root;
}

export function setD6Value(root: THREE.Object3D, value: number): void {
  const [x, y, z] = config.assets.diceFaces[value];
  root.rotation.set(x, y, z);
  root.userData.value = value;
}
