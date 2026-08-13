import * as THREE from 'three';

const FACE_VALUES = [3, 4, 2, 5, 1, 6];

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

export function createD6Mesh(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = FACE_VALUES.map(
    (value) => new THREE.MeshStandardMaterial({ map: pipTexture(value), roughness: 0.6, metalness: 0.05 }),
  );
  return new THREE.Mesh(geometry, materials);
}
