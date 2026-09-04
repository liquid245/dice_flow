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
    flat: false,
    shadowOpacity: 0.3,
    ambient: 0.6,
    key: 2,
  },
  glyph: {
    body: null,
    pips: null,
    roughness: null,
    envIntensity: 1.2,
    background: null,
    flat: false,
    shadowOpacity: 0,
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

function snapshotCanvas(canvas: HTMLCanvasElement): ImageData | null {
  const layer = document.createElement('canvas');
  layer.width = canvas.width;
  layer.height = canvas.height;
  const ctx = layer.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(canvas, 0, 0);
  return ctx.getImageData(0, 0, layer.width, layer.height);
}

function canvasFromImageData(data: ImageData): HTMLCanvasElement | null {
  const layer = document.createElement('canvas');
  layer.width = data.width;
  layer.height = data.height;
  const ctx = layer.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(data, 0, 0);
  return layer;
}

function dropSmallComponents(data: ImageData, keepFrac: number): void {
  const w = data.width;
  const h = data.height;
  const n = w * h;
  const compId = new Int32Array(n).fill(-1);
  const areas: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (compId[i] !== -1 || data.data[i * 4 + 3] < 250) continue;
    const id = areas.length;
    let area = 0;
    stack.length = 0;
    stack.push(i);
    compId[i] = id;
    while (stack.length) {
      const q = stack.pop() as number;
      area++;
      const qy = (q / w) | 0;
      const qx = q - qy * w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx;
          const ny = qy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const qq = ny * w + nx;
          if (compId[qq] === -1 && data.data[qq * 4 + 3] >= 250) {
            compId[qq] = id;
            stack.push(qq);
          }
        }
      }
    }
    areas.push(area);
  }
  const maxArea = areas.length ? Math.max(...areas) : 0;
  const threshold = maxArea * keepFrac;
  for (let i = 0; i < n; i++) {
    const id = compId[i];
    if (id !== -1 && areas[id] < threshold) data.data[i * 4 + 3] = 0;
  }
}

function addWhiteRing(data: ImageData, thickness: number): void {
  if (thickness <= 0) return;
  const w = data.width;
  const h = data.height;
  const n = w * h;
  const dist = new Uint8Array(n).fill(255);
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (data.data[i * 4 + 3] >= 128) {
      dist[i] = 0;
      visited[i] = 1;
      queue[tail++] = i;
    }
  }
  const limit = thickness + 1;
  const nb = [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1];
  while (head < tail) {
    const p = queue[head++];
    const d = dist[p];
    if (d >= limit) continue;
    const py = (p / w) | 0;
    const px = p - py * w;
    for (let k = 0; k < 8; k++) {
      const q = p + nb[k];
      if (q < 0 || q >= n) continue;
      const qy = (q / w) | 0;
      const qx = q - qy * w;
      if (Math.abs(qx - px) > 1 || Math.abs(qy - py) > 1) continue;
      if (visited[q]) continue;
      const nd = d + 1;
      if (nd > limit) continue;
      dist[q] = nd;
      visited[q] = 1;
      queue[tail++] = q;
    }
  }
  for (let i = 0; i < n; i++) {
    const d = dist[i];
    if (d === 0 || d > limit) continue;
    const alpha = d <= thickness ? 255 : 110;
    data.data[i * 4] = 255;
    data.data[i * 4 + 1] = 255;
    data.data[i * 4 + 2] = 255;
    data.data[i * 4 + 3] = alpha;
  }
}

function paintPipGradient(data: ImageData, topGray: number, bottomGray: number): void {
  const w = data.width;
  const h = data.height;
  const n = w * h;
  for (let i = 0; i < n; i++) {
    if (data.data[i * 4 + 3] < 250) continue;
    const y = (i / w) | 0;
    const t = h > 1 ? y / (h - 1) : 0;
    const gray = Math.max(0, Math.min(255, Math.round(topGray + (bottomGray - topGray) * t)));
    data.data[i * 4] = gray;
    data.data[i * 4 + 1] = gray;
    data.data[i * 4 + 2] = gray;
  }
}

function composeAlphaBody(
  passA: ImageData,
  passB: ImageData,
  amount: number,
  ring: number,
  gradTop: number,
  gradBottom: number,
): HTMLCanvasElement | null {
  const n = passA.width * passA.height;
  const out = new ImageData(passA.width, passA.height);
  const a = passA.data;
  const b = passB.data;
  const o = out.data;
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    if (a[j + 3] <= 8) continue;
    if (b[j + 3] > 24) {
      o[j] = 128;
      o[j + 1] = 128;
      o[j + 2] = 128;
      o[j + 3] = 255;
      continue;
    }
    const L = 0.299 * a[j] + 0.587 * a[j + 1] + 0.114 * a[j + 2];
    const alpha = ((1 - L / 255) * amount * 255 + 0.5) | 0;
    o[j] = 255;
    o[j + 1] = 255;
    o[j + 2] = 255;
    o[j + 3] = Math.max(0, Math.min(255, alpha));
  }
  dropSmallComponents(out, 0.45);
  paintPipGradient(out, gradTop, gradBottom);
  addWhiteRing(out, ring);
  return canvasFromImageData(out);
}

function renderGlyphCut(
  canvas: HTMLCanvasElement,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.OrthographicCamera,
  group: THREE.Group,
  groups: LodGroup[],
  amount: number,
  ring: number,
  gradTop: number,
  gradBottom: number,
): void {
  renderer.render(scene, camera);
  const passA = snapshotCanvas(canvas);
  if (!passA) return;

  const meshes = group.children as THREE.Mesh[];
  const saved: (THREE.Material | null)[] = [];
  for (let i = 0; i < groups.length; i++) {
    const mesh = meshes[i];
    if (isPips(groups[i].material)) {
      saved.push(mesh.material);
      mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    } else {
      saved.push(null);
      mesh.visible = false;
    }
  }

  renderer.render(scene, camera);
  const passB = snapshotCanvas(canvas);

  for (let i = 0; i < meshes.length; i++) {
    if (saved[i]) meshes[i].material = saved[i] as THREE.Material;
    else meshes[i].visible = true;
  }

  if (!passB) return;

  const composed = composeAlphaBody(passA, passB, amount, ring, gradTop, gradBottom);
  if (!composed) return;
  canvas.remove();
  document.body.appendChild(composed);
}

function main() {
  const params = new URLSearchParams(window.location.search);
  const themeName = params.get('theme') ?? 'light';
  const theme = THEMES[themeName] ?? THEMES.light;
  const fill = Math.min(Math.max(parseFloat(params.get('fill') ?? '1') || 1, 0.1), 3);
  const radius = Math.min(Math.max(parseFloat(params.get('radius') ?? '0') || 0, 0), 0.5);
  const view = Math.max(0, Math.min(6, parseInt(params.get('view') ?? '6', 10) || 6));
  const face = parseInt(params.get('face') ?? '-1', 10);
  const cut = Math.min(Math.max(parseFloat(params.get('cut') ?? '0') || 0, 0), 5);
  const ringValue = parseFloat(params.get('ring') ?? '0');
  const ring = Number.isFinite(ringValue) ? Math.min(Math.max(ringValue, 0), 30) : 5;
  const readGray = (name: string, fallback: number) => {
    const v = parseFloat(params.get(name) ?? String(fallback));
    return Number.isFinite(v) ? Math.max(0, Math.min(255, v)) : fallback;
  };
  const gradTop = readGray('gradtop', 235);
  const gradBottom = readGray('gradbot', 60);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  if (theme.background) {
    canvas.style.background = theme.background;
  }
  if (radius > 0) {
    canvas.style.borderRadius = `${radius * 100}%`;
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

  scene.add(new THREE.AmbientLight(0xffffff, theme.ambient));
  const key = new THREE.DirectionalLight(0xffffff, theme.key);
  key.position.set(5, 5, 10);
  scene.add(key);

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
      if (themeName === 'glyph') {
        renderGlyphCut(canvas, renderer, scene, camera, group, groups, cut, ring, gradTop, gradBottom);
      }
      (window as unknown as { __iconDone?: boolean }).__iconDone = true;
    },
    (error) => reportError('parse: ' + String(error)),
  );
}

main();
