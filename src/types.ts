export type Status = 'pass' | 'warn' | 'fail' | 'info';
export type Pillar = 'seo' | 'agent';

/**
 * How much a check matters. Essential and recommended checks drive the score;
 * minor checks nudge it; bonus checks can only add points (never subtract).
 */
export type Tier = 'essential' | 'recommended' | 'minor' | 'bonus';

export interface CheckResult {
  id: string;
  pillar: Pillar;
  category: string;
  title: string;
  tier: Tier;
  status: Status;
  /** One line shown next to the check. */
  summary: string;
  /** Evidence: offending URLs, values found, etc. */
  details?: string[];
  /** What to do about it. Only set when the check did not pass. */
  fix?: string;
}

export interface PillarScore {
  score: number;
  base: number;
  bonus: number;
  grade: Grade;
  passed: number;
  total: number;
}

export interface Grade {
  letter: string;
  label: string;
}

export interface Report {
  tool: { name: string; version: string };
  url: string;
  finalUrl: string;
  scannedAt: string;
  durationMs: number;
  overall: { score: number; grade: Grade };
  pillars: Record<Pillar, PillarScore>;
  checks: CheckResult[];
  topFixes: CheckResult[];
}
