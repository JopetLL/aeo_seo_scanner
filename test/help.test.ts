import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORY_HELP, CHECK_HELP } from '../src/report/help.ts';

// Read the check definitions straight from source so a new check can't ship without a tooltip.
const source = ['seo', 'agent', 'tags'].map((f) => readFileSync(new URL(`../src/checks/${f}.ts`, import.meta.url), 'utf8')).join('\n');
const checkIds = [...source.matchAll(/make\('([a-z0-9-]+)'/g)].map((m) => m[1]!);
const categories = new Set([
  ...[...source.matchAll(/make\('[a-z0-9-]+', '([^']+)', '[^']+', '(?:essential|recommended|minor|bonus)'\)/g)].map((m) => m[1]!),
  'Tags & tracking',
]);

test('finds the check definitions', () => {
  assert.equal(checkIds.length, 42);
  assert.equal(categories.size, 11);
});

test('every check has tooltip help', () => {
  assert.deepEqual(checkIds.filter((id) => !CHECK_HELP[id]), []);
});

test('every category has tooltip help', () => {
  assert.deepEqual([...categories].filter((c) => !CATEGORY_HELP[c]), []);
});

test('no help text for checks that no longer exist', () => {
  assert.deepEqual(Object.keys(CHECK_HELP).filter((id) => !checkIds.includes(id)), []);
});
