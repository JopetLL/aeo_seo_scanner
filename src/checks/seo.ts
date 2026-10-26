import { isAllowed } from '../robots.ts';
import type { LinkStatus, ScanContext } from '../context.ts';
import type { CheckResult, Status, Tier } from '../types.ts';

type Check = (ctx: ScanContext) => CheckResult;

const make =
  (id: string, category: string, title: string, tier: Tier) =>
  (status: Status, summary: string, extra: { details?: string[]; fix?: string } = {}): CheckResult => ({
    id,
    pillar: 'seo',
    category,
    title,
    tier,
    status,
    summary,
    ...(extra.details?.length ? { details: extra.details } : {}),
    ...(status !== 'pass' && extra.fix ? { fix: extra.fix } : {}),
  });

const GENERIC_ANCHORS = new Set([
  'click here', 'here', 'read more', 'learn more', 'more', 'this', 'link', 'go', 'continue', 'details', 'this page',
]);

const meta = (ctx: ScanContext, selector: string) => ctx.$(selector).first().attr('content')?.trim() ?? '';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ── Crawlability ────────────────────────────────────────────────────────────

const httpStatus: Check = ({ page }) => {
  const r = make('http-status', 'Crawlability', 'HTTP status', 'essential');
  return page.status === 200
    ? r('pass', '200 OK')
    : r('fail', `Returned ${page.status}`, { fix: 'Serve indexable pages with a 200 status.' });
};

const https: Check = ({ page }) => {
  const r = make('https', 'Crawlability', 'HTTPS', 'essential');
  return page.url.startsWith('https://')
    ? r('pass', 'Served over HTTPS')
    : r('fail', 'Served over plain HTTP', { fix: 'Redirect HTTP to HTTPS and serve the page over TLS.' });
};

const redirects: Check = ({ page }) => {
  const r = make('redirects', 'Crawlability', 'Redirect chain', 'recommended');
  const hops = page.hops.length;
  const details = page.hops.map((h) => `${h.status} ${h.url}`).concat(hops ? [`→ ${page.url}`] : []);
  if (hops === 0) return r('pass', 'No redirects');
  if (hops === 1) return r('pass', '1 redirect', { details });
  return r(hops === 2 ? 'warn' : 'fail', `${hops} redirects before the page`, {
    details,
    fix: 'Link straight to the final URL, or collapse the chain into a single 301.',
  });
};

const indexable: Check = (ctx) => {
  const r = make('indexable', 'Crawlability', 'Indexable', 'essential');
  const directives = [
    ...ctx.$('meta[name="robots" i], meta[name="googlebot" i]').map((_, el) => ctx.$(el).attr('content') ?? '').get(),
    ctx.page.headers.get('x-robots-tag') ?? '',
  ]
    .join(',')
    .toLowerCase();
  if (/\b(noindex|none)\b/.test(directives)) {
    return r('fail', 'Page is marked noindex', {
      details: [directives.replace(/^,+|,+$/g, '')],
      fix: 'Remove noindex from the robots meta tag or X-Robots-Tag header if this page should rank.',
    });
  }
  return r('pass', directives.includes('nofollow') ? 'Indexable (but nofollow)' : 'No noindex directive');
};

const robotsAllowsSearch: Check = (ctx) => {
  const r = make('robots-search', 'Crawlability', 'Search crawlers allowed', 'essential');
  if (!ctx.robots) return r('pass', 'No robots.txt rules, so crawling is allowed');
  const path = ctx.url.pathname + ctx.url.search;
  const blocked = ['Googlebot', 'Bingbot'].filter((bot) => !isAllowed(ctx.robots!, bot, path).allowed);
  return blocked.length
    ? r('fail', `robots.txt blocks ${blocked.join(' and ')}`, {
        fix: 'Remove the Disallow rule covering this path, or move the page out of the blocked section.',
      })
    : r('pass', 'Googlebot and Bingbot can crawl this URL');
};

const canonical: Check = (ctx) => {
  const r = make('canonical', 'Crawlability', 'Canonical URL', 'recommended');
  const tags = ctx.$('link[rel="canonical" i]');
  const href = tags.first().attr('href')?.trim();
  if (!href) return r('fail', 'No canonical tag', { fix: 'Add <link rel="canonical" href="…"> with the absolute preferred URL.' });
  if (tags.length > 1) return r('warn', `${tags.length} canonical tags`, { fix: 'Keep exactly one canonical tag.' });
  const resolved = new URL(href, ctx.page.url);
  const self = resolved.href.replace(/\/$/, '') === ctx.page.url.replace(/[?#].*$/, '').replace(/\/$/, '');
  if (!/^https?:\/\//.test(href)) {
    return r('warn', 'Canonical is a relative URL', { details: [href], fix: 'Use an absolute URL in the canonical tag.' });
  }
  return self
    ? r('pass', 'Self-referencing canonical')
    : r('warn', 'Canonical points to a different URL', {
        details: [resolved.href],
        fix: 'Check this is intended: search engines will index the canonical URL instead of this one.',
      });
};

// ── Metadata ────────────────────────────────────────────────────────────────

const title: Check = (ctx) => {
  const r = make('title', 'Metadata', 'Title tag', 'essential');
  const text = ctx.$('head title').first().text().trim();
  const count = ctx.$('head title').length;
  if (!text) return r('fail', 'Missing', { fix: 'Add a unique, descriptive <title> of 30–60 characters.' });
  const details = [`"${text}"`];
  if (count > 1) return r('warn', `${count} title tags`, { details, fix: 'Keep exactly one <title>.' });
  if (text.length < 30) return r('warn', `${text.length} chars (short)`, { details, fix: 'Aim for 30–60 characters with the main keyword near the front.' });
  if (text.length > 60) return r('warn', `${text.length} chars (may be truncated)`, { details, fix: 'Trim to about 60 characters so it is not cut off in results.' });
  return r('pass', `${text.length} chars`, { details });
};

const description: Check = (ctx) => {
  const r = make('meta-description', 'Metadata', 'Meta description', 'recommended');
  const text = meta(ctx, 'meta[name="description" i]');
  if (!text) return r('fail', 'Missing', { fix: 'Add a meta description of 70–160 characters that sells the click.' });
  const details = [`"${text}"`];
  if (text.length < 70) return r('warn', `${text.length} chars (short)`, { details, fix: 'Expand to 70–160 characters.' });
  if (text.length > 160) return r('warn', `${text.length} chars (may be truncated)`, { details, fix: 'Trim to about 160 characters.' });
  return r('pass', `${text.length} chars`, { details });
};

const lang: Check = (ctx) => {
  const r = make('lang', 'Metadata', 'Language declared', 'recommended');
  const value = ctx.$('html').attr('lang')?.trim();
  return value ? r('pass', `lang="${value}"`) : r('fail', 'No lang attribute', { fix: 'Add lang to <html>, e.g. <html lang="en">.' });
};

const viewport: Check = (ctx) => {
  const r = make('viewport', 'Metadata', 'Mobile viewport', 'recommended');
  const value = meta(ctx, 'meta[name="viewport" i]');
  if (!value) return r('fail', 'No viewport meta tag', { fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' });
  return value.includes('width=device-width')
    ? r('pass', 'width=device-width')
    : r('warn', 'Viewport does not use device-width', { details: [value], fix: 'Use width=device-width.' });
};

const openGraph: Check = (ctx) => {
  const r = make('open-graph', 'Metadata', 'Open Graph tags', 'recommended');
  const wanted = ['og:title', 'og:description', 'og:image', 'og:url'];
  const missing = wanted.filter((p) => !meta(ctx, `meta[property="${p}"]`));
  if (missing.length === 0) return r('pass', 'og:title, description, image and url present');
  const fix = `Add ${missing.join(', ')} so shares and AI previews render properly.`;
  return missing.length === wanted.length
    ? r('fail', 'No Open Graph tags', { fix })
    : r('warn', `Missing ${missing.join(', ')}`, { fix });
};

const twitterCard: Check = (ctx) => {
  const r = make('twitter-card', 'Metadata', 'Twitter/X card', 'minor');
  const card = meta(ctx, 'meta[name="twitter:card" i]');
  return card ? r('pass', card) : r('warn', 'No twitter:card tag', { fix: 'Add <meta name="twitter:card" content="summary_large_image">.' });
};

const favicon: Check = (ctx) => {
  const r = make('favicon', 'Metadata', 'Favicon', 'minor');
  return ctx.$('link[rel~="icon" i]').length
    ? r('pass', 'Declared')
    : r('warn', 'No <link rel="icon">', { fix: 'Declare a favicon; it appears next to your result in Google and AI answers.' });
};

// ── Content ─────────────────────────────────────────────────────────────────

const h1: Check = (ctx) => {
  const r = make('h1', 'Content', 'H1 heading', 'essential');
  const h1s = ctx.$('h1').map((_, el) => ctx.$(el).text().replace(/\s+/g, ' ').trim()).get();
  if (h1s.length === 0) return r('fail', 'No H1', { fix: 'Add one H1 that states what the page is about.' });
  const details = h1s.map((t) => `"${t || '(empty)'}"`);
  if (h1s.length > 1) return r('warn', `${h1s.length} H1s`, { details, fix: 'Use a single H1 and demote the others to H2.' });
  if (!h1s[0]) return r('fail', 'H1 is empty', { fix: 'Put real text in the H1 (not just an image without alt).' });
  return r('pass', '1 H1', { details });
};

const headingOrder: Check = (ctx) => {
  const r = make('heading-order', 'Content', 'Heading hierarchy', 'minor');
  const levels = ctx.$('h1, h2, h3, h4, h5, h6').map((_, el) => Number((el as { tagName: string }).tagName[1])).get();
  if (levels.length < 2) return r('pass', plural(levels.length, 'heading'));
  const skips: string[] = [];
  for (let i = 1; i < levels.length; i++) {
    if (levels[i]! > levels[i - 1]! + 1) skips.push(`H${levels[i - 1]} → H${levels[i]}`);
  }
  return skips.length
    ? r('warn', plural(skips.length, 'skipped level'), {
        details: [...new Set(skips)],
        fix: 'Nest headings in order (H2 under H1, H3 under H2) so the outline is machine-readable.',
      })
    : r('pass', `${levels.length} headings, no skipped levels`);
};

const wordCount: Check = (ctx) => {
  const r = make('word-count', 'Content', 'Content depth', 'recommended');
  const words = ctx.text ? ctx.text.split(/\s+/).length : 0;
  if (words >= 300) return r('pass', `${words.toLocaleString()} words`);
  const fix = 'Thin pages rarely rank. Add substantive, unique copy that answers the searcher’s question.';
  return words >= 100 ? r('warn', `${words} words (thin)`, { fix }) : r('fail', plural(words, 'word'), { fix });
};

const imageAlt: Check = (ctx) => {
  const r = make('image-alt', 'Content', 'Image alt text', 'recommended');
  const imgs = ctx.$('img').filter((_, el) => ctx.$(el).attr('role') !== 'presentation' && ctx.$(el).attr('aria-hidden') !== 'true');
  if (imgs.length === 0) return r('info', 'No images');
  const missing = imgs.filter((_, el) => ctx.$(el).attr('alt') === undefined);
  const pct = Math.round(((imgs.length - missing.length) / imgs.length) * 100);
  const summary = `${pct}% of ${plural(imgs.length, 'image')} have alt`;
  if (missing.length === 0) return r('pass', summary);
  const details = missing
    .map((_, el) => ctx.$(el).attr('src') ?? ctx.$(el).attr('data-src') ?? '(no src)')
    .get()
    .slice(0, 10);
  const fix = 'Add descriptive alt text (or alt="" for purely decorative images).';
  return r(pct >= 90 ? 'warn' : 'fail', summary, { details, fix });
};

// ── Links ───────────────────────────────────────────────────────────────────

const internalLinks: Check = (ctx) => {
  const r = make('internal-links', 'Links', 'Internal links', 'recommended');
  const internal = new Set(ctx.links.filter((l) => l.internal).map((l) => l.href));
  const external = new Set(ctx.links.filter((l) => !l.internal).map((l) => l.href));
  const summary = `${internal.size} internal, ${external.size} external`;
  if (internal.size >= 3) return r('pass', summary);
  const fix = 'Link to related pages on your site so crawlers and agents can discover them.';
  return internal.size > 0 ? r('warn', summary, { fix }) : r('fail', summary, { fix });
};

const anchorText: Check = (ctx) => {
  const r = make('anchor-text', 'Links', 'Descriptive anchor text', 'minor');
  if (ctx.links.length === 0) return r('info', 'No links');
  const empty = ctx.links.filter((l) => !l.text);
  const generic = ctx.links.filter((l) => GENERIC_ANCHORS.has(l.text.toLowerCase()));
  const bad = empty.length + generic.length;
  if (bad === 0) return r('pass', `All ${ctx.links.length} links have descriptive text`);
  const details = [
    ...(empty.length ? [`${plural(empty.length, 'link')} with no text or label, e.g. ${empty[0]!.href}`] : []),
    ...[...new Set(generic.map((l) => `"${l.text}" → ${l.href}`))].slice(0, 5),
  ];
  return r(bad / ctx.links.length > 0.2 ? 'fail' : 'warn', `${bad} of ${ctx.links.length} links are empty or generic`, {
    details,
    fix: 'Use anchor text that says where the link goes; give icon links an aria-label.',
  });
};

const brokenLinks: Check = (ctx) => {
  const r = make('broken-links', 'Links', 'Broken links', 'recommended');
  if (!ctx.linkStatuses) return r('info', 'Skipped (--no-links)');
  const checked = ctx.linkStatuses.length;
  const isInternal = (url: string) => ctx.links.some((l) => l.href === url && l.internal);
  // Social networks and other bot-shy sites answer scripted requests with 400/401/403/429/999.
  // On external links those prove nothing, so they are reported as unverified rather than broken.
  const botBlocked = (l: LinkStatus) => !isInternal(l.url) && [400, 401, 403, 429, 999].includes(l.status);
  const broken = ctx.linkStatuses.filter((l) => l.status >= 400 && !botBlocked(l));
  const unverified = ctx.linkStatuses.filter((l) => l.status === 0 || botBlocked(l));
  const capped = ctx.linksSkipped ? ` (first ${checked}; ${ctx.linksSkipped} not checked)` : '';
  const unverifiedNote = unverified.length ? `, ${unverified.length} unverified` : '';
  const details = [
    ...broken.map((l) => `${l.status} ${l.url}`),
    ...unverified.map((l) => `${l.status || l.error || 'unreachable'} ${l.url} (could not verify: blocks scripted requests or timed out)`),
  ];
  if (broken.length === 0) return r('pass', `${checked - unverified.length} links OK${unverifiedNote}${capped}`, { details });
  return r('fail', `${plural(broken.length, 'broken link')}${unverifiedNote}${capped}`, {
    details,
    fix: 'Update or remove links that return errors; they waste crawl budget and dead-end agents.',
  });
};

// ── Structured data ─────────────────────────────────────────────────────────

export function jsonLdTypes(ctx: ScanContext): { types: string[]; errors: string[] } {
  const types: string[] = [];
  const errors: string[] = [];
  const collect = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const t = obj['@type'];
    if (typeof t === 'string') types.push(t);
    else if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === 'string'));
    if (obj['@graph']) collect(obj['@graph']);
  };
  ctx.$('script[type="application/ld+json" i]').each((i, el) => {
    try {
      collect(JSON.parse(ctx.$(el).text()));
    } catch (err) {
      errors.push(`Block ${i + 1}: ${(err as Error).message}`);
    }
  });
  return { types: [...new Set(types)], errors };
}

const structuredData: Check = (ctx) => {
  const r = make('structured-data', 'Structured data', 'JSON-LD', 'recommended');
  const { types, errors } = jsonLdTypes(ctx);
  if (errors.length) return r('fail', 'Invalid JSON-LD', { details: errors, fix: 'Fix the JSON syntax; invalid blocks are ignored by Google.' });
  if (types.length) return r('pass', types.slice(0, 6).join(', ') + (types.length > 6 ? ` +${types.length - 6}` : ''));
  if (ctx.$('[itemscope]').length) return r('warn', 'Microdata only', { fix: 'Prefer JSON-LD, which Google recommends and agents parse more easily.' });
  return r('fail', 'No structured data', { fix: 'Add JSON-LD describing the page (Organization, Product, Article, FAQPage, BreadcrumbList…).' });
};

// ── Performance ─────────────────────────────────────────────────────────────

const responseTime: Check = ({ page }) => {
  const r = make('response-time', 'Performance', 'Response time', 'minor');
  const fix = 'Cache the HTML at the edge or speed up the server; slow responses hurt crawl rate and agents time out.';
  if (page.ms < 800) return r('pass', `${page.ms} ms`);
  return r(page.ms < 2000 ? 'warn' : 'fail', `${page.ms} ms`, { fix });
};

const htmlSize: Check = ({ page }) => {
  const r = make('html-size', 'Performance', 'HTML size', 'minor');
  const kb = Math.round(page.bytes / 1024);
  const fix = 'Trim inlined scripts, styles and hydration data; large HTML wastes crawl budget and agent context windows.';
  if (kb < 500) return r('pass', `${kb} KB`);
  return r(kb < 2048 ? 'warn' : 'fail', `${kb.toLocaleString()} KB`, { fix });
};

export const seoChecks: Check[] = [
  httpStatus, https, redirects, indexable, robotsAllowsSearch, canonical,
  title, description, lang, viewport, openGraph, twitterCard, favicon,
  h1, headingOrder, wordCount, imageAlt,
  internalLinks, anchorText, brokenLinks,
  structuredData,
  responseTime, htmlSize,
];
