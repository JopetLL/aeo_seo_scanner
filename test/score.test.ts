import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grade, scorePillar, topFixes } from '../src/score.ts';
import type { CheckResult } from '../src/types.ts';

const check = (over: Partial<CheckResult>): CheckResult => ({
  id: 'x', pillar: 'seo', category: 'c', title: 't', tier: 'recommended', status: 'pass', summary: '', ...over,
});

test('weights tiers and gives warnings half credit', () => {
  const s = scorePillar(
    [
      check({ tier: 'essential', status: 'pass' }), // 3/3
      check({ tier: 'recommended', status: 'warn' }), // 1/2
      check({ tier: 'minor', status: 'fail' }), // 0/1
    ],
    'seo',
  );
  assert.equal(s.base, Math.round((4 / 6) * 100));
  assert.equal(s.passed, 1);
  assert.equal(s.total, 3);
});

test('informational checks are excluded rather than penalised', () => {
  const s = scorePillar([check({ status: 'pass' }), check({ status: 'info' })], 'seo');
  assert.equal(s.score, 100);
  assert.equal(s.total, 1);
});

test('bonus checks only add, and are capped', () => {
  const bonus = Array.from({ length: 8 }, () => check({ pillar: 'agent', tier: 'bonus', status: 'pass' }));
  const missing = Array.from({ length: 8 }, () => check({ pillar: 'agent', tier: 'bonus', status: 'info' }));
  const base = [check({ pillar: 'agent', tier: 'essential', status: 'warn' })];
  assert.equal(scorePillar([...base, ...missing], 'agent').score, 50);
  const withBonus = scorePillar([...base, ...bonus], 'agent');
  assert.equal(withBonus.bonus, 5);
  assert.equal(withBonus.score, 55);
});

test('bonus never pushes a score past 100', () => {
  const s = scorePillar([check({ status: 'pass' }), check({ tier: 'bonus', status: 'pass' })], 'seo');
  assert.equal(s.score, 100);
});

test('grade boundaries', () => {
  assert.equal(grade(100).letter, 'A+');
  assert.equal(grade(90).letter, 'A');
  assert.equal(grade(89).letter, 'B');
  assert.equal(grade(60).letter, 'D');
  assert.equal(grade(59).label, 'Poor');
});

test('top fixes put essential failures first', () => {
  const fixes = topFixes([
    check({ id: 'minor-fail', tier: 'minor', status: 'fail', fix: 'a' }),
    check({ id: 'ess-fail', tier: 'essential', status: 'fail', fix: 'b' }),
    check({ id: 'rec-warn', tier: 'recommended', status: 'warn', fix: 'c' }),
    check({ id: 'bonus', tier: 'bonus', status: 'info', fix: 'd' }),
  ]);
  assert.deepEqual(fixes.map((f) => f.id), ['ess-fail', 'rec-warn', 'minor-fail']);
});
