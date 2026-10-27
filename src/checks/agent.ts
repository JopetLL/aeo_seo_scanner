import { isAllowed } from '../robots.ts';
import { jsonLdTypes } from './seo.ts';
import type { ScanContext } from '../context.ts';
import type { FetchResult } from '../fetcher.ts';
import type { CheckResult, Status, Tier } from '../types.ts';

type Check = (ctx: ScanContext) => CheckResult;

const make =
  (id: string, category: string, title: string, tier: Tier) =>
  (status: Status, summary: string, extra: { details?: string[]; fix?: string } = {}): CheckResult => ({
    id,
    pillar: 'agent',
    category,
    title,
    tier,
    status,
    summary,
    ...(extra.details?.length ? { details: extra.details } : {}),
    ...(status !== 'pass' && extra.fix ? { fix: extra.fix } : {}),
  });

/** Agents that fetch pages to answer a user or power AI search. Blocking these costs visibility. */
const RETRIEVAL_AGENTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User'];
/** Agents that collect training data. Blocking these is a legitimate business choice, so it is reported, not penalised. */
const TRAINING_AGENTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Meta-ExternalAgent', 'Bytespider'];

const isHtml = (res: FetchResult) =>
  (res.headers.get('content-type') ?? '').includes('text/html') || /^\s*<(!doctype|html)/i.test(res.body);
const found = (res: FetchResult | undefined) => !!res && res.status === 200 && !isHtml(res);

// ── Access ──────────────────────────────────────────────────────────────────

const aiCrawlerRules: Check = (ctx) => {
  const r = make('ai-robots', 'Access', 'AI crawlers in robots.txt', 'essential');
  if (!ctx.robots) return r('pass', 'No robots.txt rules, so all AI crawlers are allowed');
  const path = ctx.url.pathname + ctx.url.search;
  const blockedRetrieval = RETRIEVAL_AGENTS.filter((a) => !isAllowed(ctx.robots!, a, path).allowed);
  const blockedTraining = TRAINING_AGENTS.filter((a) => !isAllowed(ctx.robots!, a, path).allowed);
  const details = [
    ...(blockedRetrieval.length ? [`Search/answer agents blocked: ${blockedRetrieval.join(', ')}`] : []),
    ...(blockedTraining.length ? [`Training crawlers blocked: ${blockedTraining.join(', ')} (a policy choice, not scored)`] : []),
  ];
  if (blockedRetrieval.length === RETRIEVAL_AGENTS.length) {
    return r('fail', 'All AI search and answer agents are blocked', {
      details,
      fix: 'Allow OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User and PerplexityBot if you want to be cited in AI answers.',
    });
  }
  if (blockedRetrieval.length) {
    return r('warn', `${blockedRetrieval.length} AI search/answer agents blocked`, {
      details,
      fix: 'Unblock the AI search and user agents you want citations from. Training crawlers can stay blocked.',
    });
  }
  return r('pass', blockedTraining.length ? 'AI search agents allowed (some training crawlers blocked)' : 'All major AI agents allowed', { details });
};

const aiUserAgents: Check = (ctx) => {
  const r = make('ai-ua-access', 'Access', 'Page served to AI user-agents', 'essential');
  const entries = Object.entries(ctx.agentStatuses);
  const blocked = entries.filter(([, res]) => res.status !== 200);
  if (blocked.length === 0) return r('pass', `200 for ${entries.map(([a]) => a).join(', ')}`);
  const details = blocked.map(([agent, res]) => `${agent}: ${res.status || res.error}`);
  const caveat =
    'Some firewalls block bots that are not coming from the vendor’s published IP ranges, so a real agent may get through. Check your WAF / bot-management rules to confirm.';
  return r(blocked.length === entries.length ? 'fail' : 'warn', `${blocked.length} of ${entries.length} AI user-agents refused`, {
    details: [...details, caveat],
    fix: 'Allow verified AI agents in your CDN/WAF bot rules (e.g. Cloudflare “AI Crawl Control”).',
  });
};

const notFoundHandling: Check = (ctx) => {
  const r = make('soft-404', 'Access', 'Missing pages return 404', 'recommended');
  const res = ctx.notFoundRes;
  if (res.status === 404 || res.status === 410) return r('pass', `Nonexistent URL returns ${res.status}`);
  if (res.status === 200 && res.hops.length) {
    return r('warn', 'Missing pages redirect to a 200 page', {
      details: [`${res.requestedUrl} → ${res.url}`],
      fix: 'Return a real 404 for unknown URLs so agents and crawlers can tell a dead link from content.',
    });
  }
  if (res.status === 200) {
    return r('fail', 'Nonexistent URL returns 200 (soft 404)', {
      details: [res.requestedUrl],
      fix: 'Return status 404 for unknown URLs; soft 404s get junk pages indexed and mislead agents.',
    });
  }
  return r('warn', `Nonexistent URL returns ${res.status || res.error}`, { fix: 'Return 404 (or 410) for unknown URLs.' });
};

// ── Understanding ───────────────────────────────────────────────────────────

const serverRendered: Check = (ctx) => {
  const r = make('server-rendered', 'Understanding', 'Content in the initial HTML', 'essential');
  const words = ctx.text ? ctx.text.split(/\s+/).length : 0;
  const shell = ctx.$('#root, #app, #__next, #__nuxt, [data-reactroot]').filter((_, el) => ctx.$(el).text().trim() === '');
  if (words >= 150) return r('pass', `${words.toLocaleString()} words without running JavaScript`);
  const words_ = `${words} word${words === 1 ? '' : 's'}`;
  if (shell.length) {
    return r('fail', `Only ${words_} before JavaScript runs (empty app shell)`, {
      fix: 'Server-render or pre-render the main content. Most AI agents read the raw HTML and never run JavaScript.',
    });
  }
  return r(words < 50 ? 'fail' : 'warn', `Only ${words_} of content in the HTML`, {
    fix: 'Put the main content in the HTML response itself; agents skip content that is loaded later or missing.',
  });
};

const landmarks: Check = (ctx) => {
  const r = make('landmarks', 'Understanding', 'Semantic landmarks', 'recommended');
  const has = (sel: string) => ctx.$(sel).length > 0;
  const present = [
    has('main, [role="main"]') && 'main',
    has('nav, [role="navigation"]') && 'nav',
    has('header, [role="banner"]') && 'header',
    has('footer, [role="contentinfo"]') && 'footer',
    has('article') && 'article',
  ].filter(Boolean) as string[];
  if (present.includes('main')) return r('pass', present.map((p) => `<${p}>`).join(' '));
  const fix = 'Wrap the primary content in <main> so agents can separate it from navigation and boilerplate.';
  return present.length ? r('warn', `No <main> (found ${present.map((p) => `<${p}>`).join(' ')})`, { fix }) : r('fail', 'No landmark elements', { fix });
};

const citationMetadata: Check = (ctx) => {
  const r = make('citation-metadata', 'Understanding', 'Citation metadata', 'recommended');
  const meta = (sel: string) => !!ctx.$(sel).first().attr('content')?.trim();
  const types = jsonLdTypes(ctx).types;
  const signals: [string, boolean][] = [
    ['canonical URL', !!ctx.$('link[rel="canonical" i]').attr('href')],
    ['title', !!ctx.$('head title').text().trim() || meta('meta[property="og:title"]')],
    ['site/publisher name', meta('meta[property="og:site_name"]') || types.some((t) => ['Organization', 'WebSite', 'Corporation', 'LocalBusiness'].includes(t))],
    ['language', !!ctx.$('html').attr('lang')],
    ['preview image', meta('meta[property="og:image"]')],
  ];
  const missing = signals.filter(([, ok]) => !ok).map(([name]) => name);
  if (missing.length === 0) return r('pass', 'Canonical, title, publisher, language and image all present');
  const fix = `Add the missing ${missing.join(', ')} so AI answers can attribute and preview your page.`;
  return r(missing.length <= 2 ? 'warn' : 'fail', `Missing ${missing.join(', ')}`, { fix });
};

const labelledControls: Check = (ctx) => {
  const r = make('labelled-controls', 'Understanding', 'Labelled controls', 'recommended');
  const $ = ctx.$;
  const unlabelled: string[] = [];
  // Controls hidden from assistive tech (aria-hidden on the element or an ancestor) are invisible to agents too.
  const exposed = (_: number, el: unknown) => $(el as never).closest('[aria-hidden="true"]').length === 0;
  const fields = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea').filter(exposed);
  const buttons = $('button, [role="button"], input[type="submit"], input[type="button"], input[type="reset"]').filter(exposed);
  const labels = $('label[for]');

  fields.each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id');
    const labelled =
      $el.attr('aria-label') || $el.attr('aria-labelledby') || $el.attr('title') ||
      (id && labels.filter((_, l) => $(l).attr('for') === id).length) || $el.closest('label').length;
    if (!labelled) unlabelled.push(`<${(el as { tagName: string }).tagName} name="${$el.attr('name') ?? ''}">`);
  });
  buttons.each((_, el) => {
    const $el = $(el);
    const name =
      $el.text().trim() || $el.attr('value') || $el.attr('aria-label') || $el.attr('aria-labelledby') ||
      $el.attr('title') || $el.find('img[alt]').attr('alt') || $el.find('svg title').text().trim();
    if (!name) unlabelled.push('<button> with no accessible name');
  });
  const total = fields.length + buttons.length;
  if (total === 0) return r('info', 'No form controls');
  if (unlabelled.length === 0) return r('pass', `All ${total} controls have accessible names`);
  return r(unlabelled.length / total > 0.25 ? 'fail' : 'warn', `${unlabelled.length} of ${total} controls unlabelled`, {
    details: [...new Set(unlabelled)].slice(0, 8),
    fix: 'Give every input a <label> and every icon button an aria-label; browser agents find controls by name.',
  });
};

// ── Discovery ───────────────────────────────────────────────────────────────

const robotsTxt: Check = (ctx) => {
  const r = make('robots-txt', 'Discovery', 'robots.txt', 'recommended');
  const res = ctx.robotsRes;
  if (res.status === 200 && !isHtml(res)) return r('pass', `Found (${ctx.robots?.groups.length ?? 0} user-agent group${ctx.robots?.groups.length === 1 ? '' : 's'})`);
  if (res.status === 200) return r('warn', 'robots.txt returns an HTML page', { fix: 'Serve robots.txt as text/plain.' });
  if (res.status >= 500 || res.status === 0) {
    return r('fail', `robots.txt errors (${res.status || res.error})`, { fix: 'Crawlers treat a failing robots.txt as “disallow all”. Make it return 200 or 404.' });
  }
  return r('warn', `No robots.txt (${res.status})`, { fix: 'Publish a robots.txt that states your AI-crawler policy and points to your sitemap.' });
};

const sitemap: Check = (ctx) => {
  const r = make('sitemap', 'Discovery', 'XML sitemap', 'recommended');
  const declared = (ctx.robots?.sitemaps.length ?? 0) > 0;
  const res = ctx.sitemapRes;
  const valid = res && res.status === 200 && /<(urlset|sitemapindex)[\s>]/i.test(res.body);
  if (valid) return r('pass', declared ? 'Declared in robots.txt' : 'Found at /sitemap.xml (not declared in robots.txt)', { details: [ctx.sitemapUrl!] });
  if (res && res.status === 200) return r('warn', 'Sitemap is not valid XML', { details: [ctx.sitemapUrl!], fix: 'Serve a <urlset> or <sitemapindex> document.' });
  return r('fail', declared ? `Declared sitemap returns ${res?.status || res?.error}` : 'No sitemap found', {
    fix: 'Publish an XML sitemap and add a Sitemap: line to robots.txt.',
  });
};

// ── Bonus (emerging standards: can only add points) ─────────────────────────

const llmsTxt: Check = (ctx) => {
  const r = make('llms-txt', 'Emerging', 'llms.txt', 'bonus');
  return found(ctx.llmsRes)
    ? r('pass', 'Found at /llms.txt')
    : r('info', 'Not found', { fix: 'Optional: publish /llms.txt, a Markdown index of your key pages. Few agents read it yet.' });
};

const markdownNegotiation: Check = (ctx) => {
  const r = make('markdown', 'Emerging', 'Markdown for agents', 'bonus');
  const res = ctx.markdownRes;
  const type = res.headers.get('content-type') ?? '';
  if (res.status === 200 && type.includes('text/markdown')) {
    const vary = (res.headers.get('vary') ?? '').toLowerCase().includes('accept');
    return r('pass', 'Serves text/markdown on Accept: text/markdown', {
      details: vary ? [] : ['Response is missing Vary: Accept, so caches may serve Markdown to browsers.'],
    });
  }
  return r('info', 'No Markdown version', { fix: 'Optional: return a Markdown rendering when a request sends Accept: text/markdown.' });
};

const contentSignals: Check = (ctx) => {
  const r = make('content-signals', 'Emerging', 'Content Signals', 'bonus');
  const signals = ctx.robots?.contentSignals ?? [];
  return signals.length
    ? r('pass', signals[0]!)
    : r('info', 'Not declared', { fix: 'Optional: add Content-Signal: search=yes, ai-input=yes, ai-train=… to robots.txt.' });
};

const apiCatalog: Check = (ctx) => {
  const r = make('api-catalog', 'Emerging', 'API catalog / Link headers', 'bonus');
  const link = ctx.page.headers.get('link') ?? '';
  const rels = ['api-catalog', 'service-desc', 'service-doc', 'describedby'].filter((rel) => new RegExp(`rel="?[^";]*\\b${rel}\\b`).test(link));
  if (found(ctx.wellKnown['api-catalog'])) return r('pass', '/.well-known/api-catalog found');
  if (rels.length) return r('pass', `Link header: ${rels.join(', ')}`);
  return r('info', 'Not found', { fix: 'Optional, for API products: publish /.well-known/api-catalog (RFC 9727).' });
};

const mcpDiscovery: Check = (ctx) => {
  const r = make('mcp', 'Emerging', 'MCP / agent discovery', 'bonus');
  const hits = Object.entries(ctx.wellKnown)
    .filter(([key, res]) => key !== 'api-catalog' && found(res))
    .map(([, res]) => new URL(res.requestedUrl).pathname);
  return hits.length
    ? r('pass', hits.join(', '))
    : r('info', 'Not found', { fix: 'Optional, if you run an MCP server or agent skills: publish a server card under /.well-known/.' });
};

export const agentChecks: Check[] = [
  aiCrawlerRules, aiUserAgents, notFoundHandling,
  serverRendered, landmarks, citationMetadata, labelledControls,
  robotsTxt, sitemap,
  llmsTxt, markdownNegotiation, contentSignals, apiCatalog, mcpDiscovery,
];

export const WELL_KNOWN_PATHS: Record<string, string> = {
  'api-catalog': '/.well-known/api-catalog',
  'mcp-server-card': '/.well-known/mcp/server-card.json',
  'ai-catalog': '/.well-known/ai-catalog.json',
  'agent-skills': '/.well-known/agent-skills/index.json',
};
