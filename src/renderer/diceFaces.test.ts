import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { config } from '../config';

// Мировые грани dice-2.glb (renderer работает в мировых координатах после
// mergeByMaterial, который применяет matrixWorld): +X=6, -X=1, +Y=3, -Y=4, +Z=2, -Z=5.
const FACE_NORMALS: Record<number, [number, number, number]> = {
  1: [-1, 0, 0],
  2: [0, 0, 1],
  3: [0, 1, 0],
  4: [0, -1, 0],
  5: [0, 0, -1],
  6: [1, 0, 0],
};

// Центры пипсов каждой грани относительно центра куба (мировые координаты).
const FACE_PIPS: Record<number, [number, number, number][]> = {
  1: [[-22.3, 0, 0]],
  2: [[-11.03, -11.03, 22.3], [11.03, 11.03, 22.3]],
  3: [[-11.03, 22.3, -11.03], [0, 22.3, 0], [11.03, 22.3, 11.03]],
  4: [[-11.03, -22.3, -11.03], [11.03, -22.3, -11.03], [-11.03, -22.3, 11.03], [11.03, -22.3, 11.03]],
  5: [[-11.03, -11.03, -22.3], [11.03, -11.03, -22.3], [0, 0, -22.3], [-11.03, 11.03, -22.3], [11.03, 11.03, -22.3]],
  6: [[22.3, -11.03, -11.03], [22.3, 11.03, -11.03], [22.3, 0, -11], [22.3, 0, 11], [22.3, -11.03, 11.03], [22.3, 11.03, 11.03]],
};

function faceQuat(value: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...config.assets.diceFaces[value]));
}

describe('diceFaces orientation', () => {
  for (const value of [1, 2, 3, 4, 5, 6]) {
    it(`value ${value} points its face toward the camera (+Z)`, () => {
      const normal = new THREE.Vector3(...FACE_NORMALS[value]).applyQuaternion(faceQuat(value));
      expect(normal.x).toBeCloseTo(0, 3);
      expect(normal.y).toBeCloseTo(0, 3);
      expect(normal.z).toBeCloseTo(1, 3);
    });

    it(`value ${value} keeps its pips centered on screen`, () => {
      for (const pip of FACE_PIPS[value]) {
        const screen = new THREE.Vector3(...pip).applyQuaternion(faceQuat(value));
        expect(Math.abs(screen.x)).toBeLessThanOrEqual(12);
        expect(Math.abs(screen.y)).toBeLessThanOrEqual(12);
      }
    });
  }
});
