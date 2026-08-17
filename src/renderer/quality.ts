export interface QualityTier {
  maxDice: number;
  lod: number;
  pixelRatio: number;
}

export function qualityTier(diceCount: number, tiers: QualityTier[]): QualityTier {
  for (const tier of tiers) {
    if (diceCount <= tier.maxDice) return tier;
  }
  return tiers[tiers.length - 1];
}

export function lodLevelFor(tier: QualityTier, lodCount: number): number {
  const max = Math.max(1, lodCount);
  return Math.min(Math.max(0, tier.lod), max - 1);
}

export function adaptivePixelRatio(tier: QualityTier, devicePixelRatio: number): number {
  return Math.min(tier.pixelRatio, Math.max(1, devicePixelRatio));
}
