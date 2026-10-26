import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed, parseRobots } from '../src/robots.ts';

const robots = parseRobots(`
# comment
User-agent: *
Disallow: /admin
Allow: /admin/public
Disallow: /*.pdf$

User-agent: GPTBot
User-agent: CCBot
Disallow: /

User-agent: ChatGPT-User
Disallow:

Sitemap: https://example.com/sitemap.xml
Content-Signal: search=yes, ai-train=no
`);

test('collects sitemaps and content signals', () => {
  assert.deepEqual(robots.sitemaps, ['https://example.com/sitemap.xml']);
  assert.deepEqual(robots.contentSignals, ['search=yes, ai-train=no']);
});

test('falls back to the * group', () => {
  assert.equal(isAllowed(robots, 'Googlebot', '/').allowed, true);
  assert.equal(isAllowed(robots, 'Googlebot', '/admin/users').allowed, false);
  assert.equal(isAllowed(robots, 'Googlebot', '/admin').matchedAgent, '*');
});

test('longest match wins, so Allow can carve out of Disallow', () => {
  assert.equal(isAllowed(robots, 'Googlebot', '/admin/public/page').allowed, true);
});

test('supports * and $ wildcards', () => {
  assert.equal(isAllowed(robots, 'Googlebot', '/files/report.pdf').allowed, false);
  assert.equal(isAllowed(robots, 'Googlebot', '/files/report.pdf?v=2').allowed, true);
});

test('consecutive user-agent lines share a group', () => {
  assert.equal(isAllowed(robots, 'GPTBot', '/').allowed, false);
  assert.equal(isAllowed(robots, 'CCBot', '/anything').allowed, false);
});

test('a specific group overrides * entirely, and empty Disallow allows all', () => {
  assert.equal(isAllowed(robots, 'ChatGPT-User', '/admin').allowed, true);
});

test('agent matching is case-insensitive', () => {
  assert.equal(isAllowed(robots, 'gptbot', '/').allowed, false);
});

test('allow wins a tie between rules of equal length', () => {
  const r = parseRobots('User-agent: *\nDisallow: /page\nAllow: /page');
  assert.equal(isAllowed(r, 'x', '/page').allowed, true);
});

test('no robots groups means everything is allowed', () => {
  const r = parseRobots('');
  assert.deepEqual(isAllowed(r, 'Googlebot', '/'), { allowed: true, matchedAgent: null, rule: undefined });
});
