import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from './fake-context.ts';

const page = (body: string) => `<html lang="en"><head><title>t</title></head><body>${body}</body></html>`;

// ── image-alt ───────────────────────────────────────────────────────────────

test('image-alt skips unrendered Vue templates with no source', () => {
  const r = runCheck('image-alt', page(`
    <img src="/hero.jpg" alt="Hero">
    <img :src="partner_logo" class="logo">
    <img v-if="loading" class="spinner">`));
  assert.equal(r.status, 'pass');
  assert.equal(r.summary, '100% of 1 image have alt');
  assert.match(r.details?.[0] ?? '', /2 image templates with no source skipped/);
});

test('image-alt still flags real images without alt, and lists their sources', () => {
  const r = runCheck('image-alt', page(`
    <img src="/a.jpg" alt="A"><img src="/map.png"><img data-src="/lazy.jpg"><img :src="x">`));
  assert.equal(r.status, 'fail');
  assert.equal(r.summary, '33% of 3 images have alt');
  assert.deepEqual(r.details, ['/map.png', '/lazy.jpg', '1 image template with no source skipped (e.g. Vue :src bindings)']);
});

test('image-alt counts srcset-only images as real', () => {
  const r = runCheck('image-alt', page('<img srcset="/a.jpg 1x, /a@2x.jpg 2x">'));
  assert.equal(r.status, 'fail');
});

test('image-alt reports no rendered images when there are only templates', () => {
  const r = runCheck('image-alt', page('<img :src="a"><img v-if="b">'));
  assert.equal(r.status, 'info');
  assert.equal(r.summary, 'No rendered images (2 templates skipped)');
});

// ── labelled-controls ───────────────────────────────────────────────────────

test('labelled-controls ignores an off-screen honeypot field', () => {
  const r = runCheck('labelled-controls', page(`
    <label for="email">Email</label><input id="email" type="email">
    <input type="text" style="position: absolute; top: -1000px">`));
  assert.equal(r.status, 'pass');
  assert.equal(r.summary, 'All 1 controls have accessible names');
});

test('labelled-controls ignores controls that are themselves hidden or in an off-screen wrapper', () => {
  const r = runCheck('labelled-controls', page(`
    <input type="text" hidden>
    <select style="display:none"></select>
    <div style="left:-9999px;position:absolute"><textarea></textarea></div>
    <button>Send</button>`));
  assert.equal(r.status, 'pass');
  assert.equal(r.summary, 'All 1 controls have accessible names');
});

test('labelled-controls still checks controls inside a closed modal', () => {
  // Modals, tabs and accordions start hidden; agents use their controls once opened.
  const r = runCheck('labelled-controls', page(`
    <div class="modal" style="display: none;"><select id="industry"></select><button>Book</button></div>
    <div hidden><input type="email" aria-label="Email"></div>`));
  assert.equal(r.status, 'fail');
  assert.equal(r.summary, '1 of 3 controls unlabelled');
});

test('labelled-controls still flags a visible unlabelled field', () => {
  const r = runCheck('labelled-controls', page(`
    <input type="text" name="q" style="position: relative; top: -2px">
    <button aria-label="Search"></button>`));
  assert.equal(r.status, 'fail');
  assert.equal(r.summary, '1 of 2 controls unlabelled');
});
