import { describe, it, expect } from 'vitest';
import { qualityTier, lodLevelFor, adaptivePixelRatio, type QualityTier } from './quality';

const tiers: QualityTier[] = [
  { maxDice: 30, lod: 0, pixelRatio: 2 },
  { maxDice: 100, lod: 1, pixelRatio: 1 },
  { maxDice: Infinity, lod: 2, pixelRatio: 1 },
];

describe('qualityTier', () => {
  it('picks the first tier for small counts', () => {
    expect(qualityTier(0, tiers)).toBe(tiers[0]);
    expect(qualityTier(30, tiers)).toBe(tiers[0]);
  });

  it('picks the middle tier', () => {
    expect(qualityTier(31, tiers)).toBe(tiers[1]);
    expect(qualityTier(100, tiers)).toBe(tiers[1]);
  });

  it('picks the last tier for large counts', () => {
    expect(qualityTier(101, tiers)).toBe(tiers[2]);
    expect(qualityTier(1000, tiers)).toBe(tiers[2]);
  });
});

describe('lodLevelFor', () => {
  it('clamps to the available lod count', () => {
    expect(lodLevelFor({ maxDice: Infinity, lod: 5, pixelRatio: 1 }, 3)).toBe(2);
    expect(lodLevelFor({ maxDice: Infinity, lod: 0, pixelRatio: 1 }, 3)).toBe(0);
  });

  it('never goes below zero', () => {
    expect(lodLevelFor({ maxDice: Infinity, lod: -1, pixelRatio: 1 }, 3)).toBe(0);
  });

  it('handles a single lod level', () => {
    expect(lodLevelFor({ maxDice: Infinity, lod: 0, pixelRatio: 1 }, 1)).toBe(0);
  });
});

describe('adaptivePixelRatio', () => {
  it('caps the device pixel ratio to the tier limit', () => {
    expect(adaptivePixelRatio({ maxDice: Infinity, lod: 0, pixelRatio: 2 }, 3)).toBe(2);
    expect(adaptivePixelRatio({ maxDice: Infinity, lod: 0, pixelRatio: 1 }, 3)).toBe(1);
  });

  it('never goes below one', () => {
    expect(adaptivePixelRatio({ maxDice: Infinity, lod: 0, pixelRatio: 2 }, 0.5)).toBe(1);
  });
});
