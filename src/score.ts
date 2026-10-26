import type { CheckResult, Grade, Pillar, PillarScore } from './types.ts';

export const TIER_WEIGHT = { essential: 3, recommended: 2, minor: 1, bonus: 0 } as const;
const CREDIT = { pass: 1, warn: 0.5, fail: 0 } as const;
/** Each passing bonus check adds this many points, up to BONUS_CAP. */
const BONUS_POINTS = 1;
const BONUS_CAP = 5;

export function grade(score: number): Grade {
  if (score >= 95) return { letter: 'A+', label: 'Excellent' };
  if (score >= 90) return { letter: 'A', label: 'Excellent' };
  if (score >= 80) return { letter: 'B', label: 'Good' };
  if (score >= 70) return { letter: 'C', label: 'Fair' };
  if (score >= 60) return { letter: 'D', label: 'Needs work' };
  return { letter: 'F', label: 'Poor' };
}

/**
 * Weighted share of available points: essential checks count 3x, recommended 2x, minor 1x.
 * Warnings earn half credit. Informational results are left out entirely, so a page is
 * never marked down for something that does not apply (no images, no forms…).
 */
export function scorePillar(checks: CheckResult[], pillar: Pillar): PillarScore {
  const mine = checks.filter((c) => c.pillar === pillar);
  const scored = mine.filter((c) => c.tier !== 'bonus' && c.status !== 'info');

  let earned = 0;
  let possible = 0;
  for (const c of scored) {
    const w = TIER_WEIGHT[c.tier];
    possible += w;
    earned += w * CREDIT[c.status as keyof typeof CREDIT];
  }
  const base = possible ? Math.round((earned / possible) * 100) : 100;
  const bonusPasses = mine.filter((c) => c.tier === 'bonus' && c.status === 'pass').length;
  const bonus = Math.min(bonusPasses * BONUS_POINTS, BONUS_CAP, 100 - base);
  const score = base + bonus;

  return {
    score,
    base,
    bonus,
    grade: grade(score),
    passed: scored.filter((c) => c.status === 'pass').length,
    total: scored.length,
  };
}

/** The most valuable things to fix: failures before warnings, heavier tiers first. */
export function topFixes(checks: CheckResult[], limit = 5): CheckResult[] {
  const impact = (c: CheckResult) => TIER_WEIGHT[c.tier] * (c.status === 'fail' ? 1 : 0.5);
  return checks
    .filter((c) => c.tier !== 'bonus' && (c.status === 'fail' || c.status === 'warn') && c.fix)
    .sort((a, b) => impact(b) - impact(a) || TIER_WEIGHT[b.tier] - TIER_WEIGHT[a.tier])
    .slice(0, limit);
}
