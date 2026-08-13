import * as THREE from 'three';
import { faceArrangement } from './faces';

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [0, 0],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [-1, 0],
    [1, 0],
  ],
};

function pipTexture(value: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1a1a1a';

  const radius = size * 0.09;
  const center = size / 2;
  const offset = size * 0.27;
  for (const [px, py] of PIPS[value]) {
    ctx.beginPath();
    ctx.arc(center + px * offset, center + py * offset, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let sharedTextures: Map<number, THREE.CanvasTexture> | null = null;

export function getPipTextures(): Map<number, THREE.CanvasTexture> {
  if (!sharedTextures) {
    sharedTextures = new Map<number, THREE.CanvasTexture>();
    for (let value = 1; value <= 6; value++) {
      sharedTextures.set(value, pipTexture(value));
    }
  }
  return sharedTextures;
}

export function createD6Mesh(value: number): THREE.Mesh {
  const textures = getPipTextures();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = faceArrangement(value).map(
    (faceValue) =>
      new THREE.MeshStandardMaterial({ map: textures.get(faceValue), roughness: 0.6, metalness: 0.05 }),
  );
  return new THREE.Mesh(geometry, materials);
}

export function setD6Value(mesh: THREE.Mesh, value: number): void {
  const textures = getPipTextures();
  const materials = mesh.material as THREE.MeshStandardMaterial[];
  faceArrangement(value).forEach((faceValue, index) => {
    materials[index].map = textures.get(faceValue) ?? null;
    materials[index].needsUpdate = true;
  });
}
