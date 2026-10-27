import { CATEGORY_HELP, CHECK_HELP } from './help.ts';
import type { CheckResult, PillarScore, Report } from '../types.ts';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const tone = (score: number) => (score >= 80 ? 'good' : score >= 60 ? 'ok' : 'bad');

function ring(score: number, label: string, sub: string, large = false): string {
  const r = 52;
  const c = 2 * Math.PI * r;
  return `
  <figure class="ring ${large ? 'ring-lg' : ''} ${tone(score)}">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="track" cx="60" cy="60" r="${r}"/>
      <circle class="value" cx="60" cy="60" r="${r}" stroke-dasharray="${((score / 100) * c).toFixed(1)} ${c.toFixed(1)}"/>
    </svg>
    <div class="ring-text"><strong>${score}</strong></div>
    <figcaption>${esc(label)}<span>${esc(sub)}</span></figcaption>
  </figure>`;
}

function pillarSub(p: PillarScore) {
  return `${p.grade.letter} · ${p.passed}/${p.total} passed${p.bonus ? ` · +${p.bonus} bonus` : ''}`;
}

const STATUS_LABEL = { pass: 'Pass', warn: 'Warning', fail: 'Fail', info: '—' } as const;

function checkRow(c: CheckResult): string {
  const details = c.details?.length ? `<ul class="details">${c.details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : '';
  const fix = c.fix ? `<p class="fix">${esc(c.fix)}</p>` : '';
  const body = details || fix ? `<div class="more">${details}${fix}</div>` : '';
  return `
    <li class="check ${c.status}">
      <span class="badge" title="${STATUS_LABEL[c.status]}">${STATUS_LABEL[c.status]}</span>
      <div class="check-main">
        <div class="check-head"><span class="check-title">${esc(c.title)}</span>${tooltip(c.title, CHECK_HELP[c.id], `check-${c.id}`)}${c.tier === 'essential' ? '<span class="tier">Essential</span>' : ''}</div>
        <div class="summary">${esc(c.summary)}</div>
        ${body}
      </div>
    </li>`;
}

function tooltip(label: string, text: string | undefined, key: string): string {
  if (!text) return '';
  const id = `tip-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return `<span class="tip"><button type="button" class="tip-btn" aria-label="About ${esc(label)}" aria-describedby="${id}">?</button><span class="tip-body" role="tooltip" id="${id}">${esc(text)}</span></span>`;
}

function section(report: Report, pillar: 'seo' | 'agent', heading: string): string {
  const checks = report.checks.filter((c) => c.pillar === pillar);
  const categories = [...new Set(checks.map((c) => c.category))];
  return `
  <section class="pillar">
    <h2>${heading}</h2>
    ${categories
      .map((cat) => {
        const inCat = checks.filter((c) => c.category === cat);
        const note = inCat[0]?.tier === 'bonus' ? '<span class="note">Bonus: can only add points</span>' : '';
        return `<h3>${esc(cat)}${tooltip(cat, CATEGORY_HELP[cat], cat)} ${note}</h3><ul class="checks">${inCat.map(checkRow).join('')}</ul>`;
      })
      .join('')}
  </section>`;
}

export function renderHtml(report: Report): string {
  const host = new URL(report.finalUrl).hostname;
  const date = new Date(report.scannedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const fixes = report.topFixes.length
    ? `<section class="fixes"><h2>Top fixes</h2><ol>${report.topFixes
        .map((c) => `<li><strong>${esc(c.title)}</strong> <span class="pill">${c.pillar === 'seo' ? 'SEO' : 'Agents'} · ${c.tier}</span><p>${esc(c.fix!)}</p></li>`)
        .join('')}</ol></section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>aeo_seo_scanner · ${esc(host)}</title>
<meta name="description" content="SEO and AI-agent readiness report for ${esc(report.finalUrl)}: ${report.overall.score}/100.">
<style>
:root {
  --bg: #f7f7f5; --surface: #ffffff; --text: #18181b; --muted: #6b6b73; --line: #e4e4e7;
  --good: #15803d; --ok: #b45309; --bad: #b91c1c; --info: #a1a1aa; --track: #ececef; --accent: #4f46e5;
  --good-bg: #dcfce7; --ok-bg: #fef3c7; --bad-bg: #fee2e2; --info-bg: #f4f4f5;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f0f11; --surface: #18181b; --text: #f4f4f5; --muted: #a1a1aa; --line: #2a2a30;
    --good: #4ade80; --ok: #fbbf24; --bad: #f87171; --info: #71717a; --track: #27272a; --accent: #818cf8;
    --good-bg: #14532d55; --ok-bg: #78350f55; --bad-bg: #7f1d1d55; --info-bg: #27272a;
  }
}
:root[data-theme="dark"] {
  --bg: #0f0f11; --surface: #18181b; --text: #f4f4f5; --muted: #a1a1aa; --line: #2a2a30;
  --good: #4ade80; --ok: #fbbf24; --bad: #f87171; --info: #71717a; --track: #27272a; --accent: #818cf8;
  --good-bg: #14532d55; --ok-bg: #78350f55; --bad-bg: #7f1d1d55; --info-bg: #27272a;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 920px; margin: 0 auto; padding: 32px 16px 64px; }
header .brand { font-weight: 700; letter-spacing: -0.02em; color: var(--accent); }
header h1 { font-size: clamp(22px, 4vw, 30px); margin: 4px 0; letter-spacing: -0.02em; overflow-wrap: anywhere; }
header .meta { color: var(--muted); font-size: 13px; margin: 0; }
.scores { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; justify-content: center; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 24px 16px; margin: 24px 0; }
.ring { position: relative; margin: 0; width: 140px; text-align: center; }
.ring-lg { width: 190px; }
.ring svg { width: 100%; transform: rotate(-90deg); }
.ring circle { fill: none; stroke-width: 10; }
.ring .track { stroke: var(--track); }
.ring .value { stroke-linecap: round; }
.ring.good .value { stroke: var(--good); } .ring.ok .value { stroke: var(--ok); } .ring.bad .value { stroke: var(--bad); }
.ring-text { position: absolute; top: 0; left: 0; right: 0; aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-text strong { font-size: 34px; line-height: 1; } .ring-lg .ring-text strong { font-size: 48px; }
.ring figcaption { font-weight: 600; margin-top: 6px; }
.ring figcaption span { display: block; font-size: 12px; font-weight: 400; color: var(--muted); }
.fixes, .pillar { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 20px; margin: 16px 0; }
h2 { font-size: 18px; margin: 0 0 8px; }
h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 20px 0 6px; }
h3, .check-head { position: relative; }
h3 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tip { display: inline-flex; }
.tip-btn { width: 16px; height: 16px; padding: 0; border-radius: 50%; border: 1px solid var(--muted); background: transparent; color: var(--muted); font: 600 10px/1 ui-sans-serif, system-ui, sans-serif; cursor: help; display: inline-flex; align-items: center; justify-content: center; }
.tip-btn:hover, .tip-btn:focus-visible { border-color: var(--accent); color: var(--accent); outline: none; }
.tip-body { position: absolute; left: 0; top: calc(100% + 6px); z-index: 10; width: 340px; max-width: calc(100vw - 48px); padding: 10px 12px; border-radius: 10px; background: var(--text); color: var(--bg); font: 400 13px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; text-transform: none; letter-spacing: 0; box-shadow: 0 8px 24px rgb(0 0 0 / 0.18); opacity: 0; visibility: hidden; transition: opacity 0.12s; pointer-events: none; }
.tip:hover .tip-body, .tip-btn:focus-visible + .tip-body, .tip-btn:focus + .tip-body { opacity: 1; visibility: visible; }
.note { text-transform: none; letter-spacing: 0; font-weight: 400; margin-left: 6px; }
.fixes ol { margin: 0; padding-left: 20px; } .fixes li { margin: 10px 0; } .fixes p { margin: 2px 0 0; color: var(--muted); }
.pill, .tier { font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
.checks { list-style: none; margin: 0; padding: 0; }
.check { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); }
.check:first-child { border-top: 0; }
.badge { flex: 0 0 72px; text-align: center; font-size: 12px; font-weight: 600; border-radius: 6px; padding: 2px 0; height: fit-content; }
.pass .badge { color: var(--good); background: var(--good-bg); } .warn .badge { color: var(--ok); background: var(--ok-bg); }
.fail .badge { color: var(--bad); background: var(--bad-bg); } .info .badge { color: var(--info); background: var(--info-bg); }
.check-main { min-width: 0; flex: 1; }
.check-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.check-title { font-weight: 600; }
.summary { color: var(--muted); overflow-wrap: anywhere; }
.more { margin-top: 6px; }
.details { margin: 0; padding-left: 18px; font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); overflow-wrap: anywhere; }
.fix { margin: 6px 0 0; padding-left: 10px; border-left: 3px solid var(--accent); }
footer { color: var(--muted); font-size: 12px; text-align: center; margin-top: 32px; }
footer a { color: inherit; }
@media (max-width: 520px) { .badge { flex-basis: 60px; } .check-head .tip-body { left: -72px; } .ring { width: 120px; } .ring-lg { width: 170px; } }
</style>
</head>
<body>
<main>
  <header>
    <div class="brand">aeo_seo_scanner</div>
    <h1>${esc(report.finalUrl)}</h1>
    <p class="meta">Scanned ${esc(date)} · ${(report.durationMs / 1000).toFixed(1)}s · v${esc(report.tool.version)}</p>
  </header>
  <div class="scores">
    ${ring(report.overall.score, 'Overall', `${report.overall.grade.letter} · ${report.overall.grade.label}`, true)}
    ${ring(report.pillars.seo.score, 'SEO', pillarSub(report.pillars.seo))}
    ${ring(report.pillars.agent.score, 'AI agents', pillarSub(report.pillars.agent))}
  </div>
  ${fixes}
  ${section(report, 'seo', 'SEO')}
  ${section(report, 'agent', 'AI agent readiness')}
  <footer>Generated by <a href="https://github.com/JopetLL/aeo_seo_scanner">aeo_seo_scanner</a>. Scores reflect one public snapshot of the page; review the evidence before acting.</footer>
</main>
</body>
</html>
`;
}
