import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessAdvice, assessAccess, scoredPageLabel } from '../src/access.ts';

// Trimmed copies of real responses seen in the wild.
const DATADOME_403 = `<html lang="en"><head><title>nytimes.com</title></head><body style="margin:0"><p id="cmsg">Please enable JS and disable any ad blocker</p><script data-cfasync="false">var dd={'rt':'c','host':'geo.captcha-delivery.com'}</script></body></html>`;
const CLOUDFLARE_403 = `<!DOCTYPE html><html lang="en-US"><head><title>Attention Required! | Cloudflare</title><meta name="robots" content="noindex, nofollow" /></head><body><div id="cf-error-details">Sorry, you have been blocked</div></body></html>`;
const REDDIT_CHALLENGE = `<!DOCTYPE html><html lang="en"><head><title>Reddit</title><script>document.addEventListener("DOMContentLoaded",async function(){/* js_challenge */})</script></head><body><form hidden method="GET" action="/"></form></body></html>`;
const PARKED_STUB = `<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>`;
const AKAMAI_DENIED = `<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY><H1>Access Denied</H1>You don't have permission to access this server.<P>Reference&#32;&#35;18&#46;f52231a1</BODY></HTML>`;

test('a 403 from DataDome is a block page, with the vendor named', () => {
  const w = assessAccess(403, DATADOME_403, 8);
  assert.equal(w?.kind, 'http-error');
  assert.equal(w?.vendor, 'DataDome');
  assert.equal(scoredPageLabel(w!), 'block page');
  assert.match(w!.message, /blocked by DataDome/);
});

test('a 403 from Cloudflare is a block page', () => {
  const w = assessAccess(403, CLOUDFLARE_403, 6);
  assert.equal(w?.vendor, 'Cloudflare');
  assert.match(accessAdvice(w!), /AI crawlers/);
});

test('the DataDome response header is enough to name the vendor', () => {
  const w = assessAccess(403, '<html><body>Forbidden</body></html>', 1, new Headers({ 'x-datadome': 'protected' }));
  assert.equal(w?.vendor, 'DataDome');
});

test('a plain 404 or 500 is an error page, not a block', () => {
  const w = assessAccess(404, '<html><body><h1>Not found</h1></body></html>', 2);
  assert.equal(w?.kind, 'http-error');
  assert.equal(w?.vendor, undefined);
  assert.equal(scoredPageLabel(w!), 'error page');
  assert.match(accessAdvice(w!), /Fix the 404/);
  assert.equal(scoredPageLabel(assessAccess(503, '<p>down</p>', 1)!), 'error page');
});

test('a 200 challenge page with no content is detected', () => {
  const w = assessAccess(200, REDDIT_CHALLENGE, 1);
  assert.equal(w?.kind, 'bot-challenge');
  assert.equal(scoredPageLabel(w!), 'challenge page');
});

test('Akamai Access Denied is recognised', () => {
  assert.equal(assessAccess(403, AKAMAI_DENIED, 12)?.vendor, 'Akamai');
});

test('a JavaScript redirect stub is detected with its target', () => {
  const w = assessAccess(200, PARKED_STUB, 0);
  assert.equal(w?.kind, 'js-redirect');
  assert.equal(w?.target, '/lander');
  assert.equal(scoredPageLabel(w!), 'redirect stub');
  assert.match(accessAdvice(w!), /301\/308 to \/lander/);
});

test('a meta refresh stub is detected', () => {
  const w = assessAccess(200, '<html><head><meta http-equiv="refresh" content="0; url=https://example.com/home"></head></html>', 0);
  assert.equal(w?.target, 'https://example.com/home');
});

test('a normal page is not flagged, even if it embeds a Cloudflare Turnstile widget or mentions location', () => {
  const body = `<html><head><title>Contact</title><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
    <script>if (x) location.href = "/thanks";</script></head><body>${'word '.repeat(400)}</body></html>`;
  assert.equal(assessAccess(200, body, 400), null);
});

test('a short real page without challenge or redirect markers is not flagged', () => {
  assert.equal(assessAccess(200, '<html><body><h1>Example Domain</h1><p>This domain is for examples.</p></body></html>', 7), null);
});
