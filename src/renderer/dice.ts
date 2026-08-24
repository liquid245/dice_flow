import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { config } from '../config';

export interface LodGroup {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

let groupsPromise: Promise<LodGroup[]> | null = null;

function mergeByMaterial(scene: THREE.Object3D): LodGroup[] {
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
  const center = box.getCenter(new THREE.Vector3());
  for (const group of groups) {
    group.geometry.translate(-center.x, -center.y, -center.z);
    group.geometry.scale(scale, scale, scale);
    group.geometry.computeBoundingBox();
    group.geometry.computeBoundingSphere();
  }

  return groups;
}

export function loadDiceModel(): Promise<LodGroup[]> {
  if (!groupsPromise) {
    groupsPromise = new GLTFLoader().loadAsync(config.assets.diceModel).then((gltf) => mergeByMaterial(gltf.scene));
  }
  return groupsPromise;
}
