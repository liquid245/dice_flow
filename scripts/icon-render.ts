import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface LodGroup {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

interface ThemeConfig {
  body: number | null;
  pips: number | null;
  roughness: number | null;
  envIntensity: number;
  background: string | null;
  rounded: boolean;
  flat: boolean;
  shadowOpacity: number;
  ambient: number;
  key: number;
}

const THEMES: Record<string, ThemeConfig> = {
  light: {
    body: null,
    pips: null,
    roughness: null,
    envIntensity: 1,
    background: 'linear-gradient(135deg, #ffffff 0%, #e9edf0 55%, #d5dbe1 100%)',
    rounded: true,
    flat: false,
    shadowOpacity: 0.4,
    ambient: 0.6,
    key: 1.2,
  },
  dark: {
    body: 0x000000,
    pips: 0xffffff,
    roughness: 0.2,
    envIntensity: 2,
    background: 'linear-gradient(135deg, #34343b 0%, #1e1e24 55%, #111115 100%)',
    rounded: true,
    flat: false,
    shadowOpacity: 0.3,
    ambient: 0.6,
    key: 2,
  },
  tinted: {
    body: 0x2e2e36,
    pips: 0xffffff,
    roughness: 0.3,
    envIntensity: 1,
    background: 'linear-gradient(135deg, #34343b 0%, #1e1e24 55%, #111115 100%)',
    rounded: true,
    flat: false,
    shadowOpacity: 0.3,
    ambient: 0.7,
    key: 1.8,
  },
};

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

function isPips(material: THREE.Material): boolean {
  const color = material.color as THREE.Color | undefined;
  if (!color) return false;
  return color.r + color.g + color.b < 0.9;
}

function buildMaterials(groups: LodGroup[], theme: ThemeConfig): THREE.Material[] {
  return groups.map((group) => {
    if (theme.flat) {
      return new THREE.MeshBasicMaterial({ color: 0x000000 });
    }
    const base = group.material as THREE.MeshStandardMaterial;
    const material = base.clone();
    const pip = isPips(group.material);
    const override = pip ? theme.pips : theme.body;
    if (override !== null) {
      material.color = new THREE.Color(override);
    }
    if (theme.roughness !== null) {
      material.roughness = theme.roughness;
    }
    material.envMapIntensity = theme.envIntensity;
    return material;
  });
}

function makeShadowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(128, 96, 8, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(canvas);
}

function main() {
  const params = new URLSearchParams(window.location.search);
  const themeName = params.get('theme') ?? 'light';
  const theme = THEMES[themeName] ?? THEMES.light;
  const fill = Math.min(Math.max(parseFloat(params.get('fill') ?? '1') || 1, 0.1), 1);
  const view = Math.max(0, Math.min(6, parseInt(params.get('view') ?? '6', 10) || 6));
  const face = parseInt(params.get('face') ?? '-1', 10);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  if (theme.background) {
    canvas.style.background = theme.background;
  }
  if (!theme.rounded) {
    canvas.style.borderRadius = '0';
  }
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const group = new THREE.Group();
  const base = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI / 2));
  if (face >= 0 && face <= 5) {
    const FACES: [number, number, number][] = [
      [0, -Math.PI / 2, 0],
      [0, Math.PI / 2, 0],
      [-Math.PI / 2, 0, 0],
      [Math.PI / 2, 0, 0],
      [0, 0, 0],
      [0, Math.PI, 0],
    ];
    group.quaternion.setFromEuler(new THREE.Euler(...FACES[face]));
  } else {
    const VIEWS: [number, number, number][] = [
      [0, 0, 0],
      [Math.PI / 2, 0, 0],
      [-Math.PI / 2, 0, 0],
      [0, Math.PI / 2, 0],
      [0, -Math.PI / 2, 0],
      [0, 0, Math.PI / 2],
      [0, 0, -Math.PI / 2],
    ];
    const viewQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...VIEWS[view]));
    group.quaternion.copy(viewQ).multiply(base);
  }
  scene.add(group);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(0, 0, 50);
  camera.lookAt(0, 0, 0);

  if (theme.background !== null) {
    scene.add(new THREE.AmbientLight(0xffffff, theme.ambient));
    const key = new THREE.DirectionalLight(0xffffff, theme.key);
    key.position.set(5, 5, 10);
    scene.add(key);
  }

  const loader = new GLTFLoader();

  loader.loadAsync('./dice-2.glb').then(
    (gltf) => {
      const groups = mergeByMaterial(gltf.scene);
      const materials = buildMaterials(groups, theme);
      for (let i = 0; i < groups.length; i++) {
        group.add(new THREE.Mesh(groups[i].geometry, materials[i]));
      }

      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const die = Math.max(size.x, size.y);
      const half = die / 2 / fill;
      camera.left = -half;
      camera.right = half;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();

      if (theme.shadowOpacity > 0) {
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map: makeShadowTexture(),
            transparent: true,
            opacity: theme.shadowOpacity,
            depthWrite: false,
          }),
        );
        shadow.position.set(0, -die * 0.18, -0.6);
        shadow.scale.set(die * 2.4, die * 2.2, 1);
        scene.add(shadow);
      }

      renderer.render(scene, camera);
      (window as unknown as { __iconDone?: boolean }).__iconDone = true;
    },
    (error) => reportError('parse: ' + String(error)),
  );
}

main();
