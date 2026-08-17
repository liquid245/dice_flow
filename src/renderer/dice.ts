import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { config } from '../config';

export interface LodGroup {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

export interface DiceLod {
  groups: LodGroup[];
  vertices: number;
}

interface LodEntry {
  file: string;
  vertices: number;
}

interface ModelEntry {
  name: string;
  lods: LodEntry[];
}

interface Manifest {
  models: ModelEntry[];
}

let manifestPromise: Promise<Manifest> | null = null;
const lodPromises = new Map<string, Promise<DiceLod>>();

function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(config.assets.modelManifest).then((response) => {
      if (!response.ok) throw new Error(`Failed to load model manifest: ${response.status}`);
      return response.json() as Promise<Manifest>;
    });
  }
  return manifestPromise;
}

function mergeByMaterial(scene: THREE.Object3D): DiceLod {
  scene.updateMatrixWorld(true);
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    const list = byMaterial.get(material);
    if (list) list.push(geometry);
    else byMaterial.set(material, [geometry]);
  });

  const groups: LodGroup[] = [];
  for (const [material, geometries] of byMaterial) {
    const geometry =
      geometries.length === 1 ? geometries[0] : BufferGeometryUtils.mergeGeometries(geometries, false);
    if (geometry) groups.push({ geometry, material });
  }

  const box = new THREE.Box3();
  for (const group of groups) {
    group.geometry.computeBoundingBox();
    if (group.geometry.boundingBox) box.union(group.geometry.boundingBox);
  }
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = config.layout.dieSize / maxDim;
  for (const group of groups) {
    group.geometry.scale(scale, scale, scale);
    group.geometry.computeBoundingBox();
    group.geometry.computeBoundingSphere();
  }

  return { groups, vertices: 0 };
}

export interface DiceModel {
  lodCount: number;
  loadLod(level: number): Promise<DiceLod>;
}

export async function loadDiceModel(): Promise<DiceModel> {
  const manifest = await loadManifest();
  const model = manifest.models[0];
  if (!model) throw new Error('No models in the manifest');
  const base = config.assets.modelManifest.replace(/manifest\.json$/, '');
  return {
    lodCount: model.lods.length,
    loadLod(level: number): Promise<DiceLod> {
      const entry = model.lods[Math.min(Math.max(level, 0), model.lods.length - 1)];
      const url = base + entry.file;
      let promise = lodPromises.get(url);
      if (!promise) {
        promise = new GLTFLoader().loadAsync(url).then((gltf) => mergeByMaterial(gltf.scene));
        lodPromises.set(url, promise);
      }
      return promise;
    },
  };
}
