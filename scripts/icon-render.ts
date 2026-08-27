import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface LodGroup {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

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
  const center = box.getCenter(new THREE.Vector3());
  for (const group of groups) {
    group.geometry.translate(-center.x, -center.y, -center.z);
    group.geometry.computeBoundingBox();
  }
  return groups;
}

function reportError(message: string) {
  const div = document.createElement('pre');
  div.id = 'icon-error';
  div.textContent = message;
  document.body.appendChild(div);
}

window.addEventListener('error', (event) => reportError('error: ' + event.message));
window.addEventListener('unhandledrejection', (event) => reportError('rejection: ' + String(event.reason)));

function main() {
  const params = new URLSearchParams(window.location.search);
  const fill = Math.min(Math.max(parseFloat(params.get('fill') ?? '1') || 1, 0.1), 1);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  const group = new THREE.Group();
  group.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  scene.add(group);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(0, 0, 50);
  camera.lookAt(0, 0, 0);

  const loader = new GLTFLoader();

  loader.loadAsync('./dice-2.glb').then(
    (gltf) => {
      const groups = mergeByMaterial(gltf.scene);
      for (const lod of groups) {
        const flat = new THREE.MeshBasicMaterial({ color: lod.material.color });
        group.add(new THREE.Mesh(lod.geometry, flat));
      }

      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const half = Math.max(size.x, size.y) / 2 / fill;
      camera.left = -half;
      camera.right = half;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      (window as unknown as { __iconDone?: boolean }).__iconDone = true;
    },
    (error) => reportError('parse: ' + String(error)),
  );
}

main();
