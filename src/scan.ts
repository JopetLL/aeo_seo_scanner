import * as cheerio from 'cheerio';
import { AI_AGENT_UAS, fetchUrl, mapLimit, type FetchResult } from './fetcher.ts';
import { parseRobots } from './robots.ts';
import { seoChecks } from './checks/seo.ts';
import { agentChecks, WELL_KNOWN_PATHS } from './checks/agent.ts';
import { scorePillar, topFixes, grade } from './score.ts';
import type { LinkInfo, LinkStatus, ScanContext } from './context.ts';
import type { Report } from './types.ts';

export const VERSION = '0.1.0';

export interface ScanOptions {
  checkLinks?: boolean;
  maxLinks?: number;
  timeout?: number;
  onProgress?: (message: string) => void;
}

export class ScanError extends Error {}

export function normaliseUrl(input: string): URL {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    return new URL(withScheme);
  } catch {
    throw new ScanError(`Not a valid URL: ${input}`);
  }
}

export async function scan(input: string, opts: ScanOptions = {}): Promise<Report> {
  const { checkLinks = true, maxLinks = 50, timeout = 15_000, onProgress = () => {} } = opts;
  const started = Date.now();
  const requested = normaliseUrl(input);

  onProgress(`Fetching ${requested.href}`);
  const page = await fetchUrl(requested.href, { timeout });
  if (page.status === 0) throw new ScanError(`Could not reach ${requested.href} (${page.error})`);
  if (!(page.headers.get('content-type') ?? '').includes('html') && page.status === 200) {
    throw new ScanError(`${page.url} is not an HTML page (${page.headers.get('content-type')})`);
  }

  const url = new URL(page.url);
  const origin = url.origin;
  const $ = cheerio.load(page.body);
  const links = extractLinks($, page.url);

  onProgress('Checking robots.txt, sitemap, AI user-agents and well-known files');
  const get = (path: string, extra: Parameters<typeof fetchUrl>[1] = {}) => fetchUrl(new URL(path, origin).href, { timeout, ...extra });
  const [robotsRes, notFoundRes, markdownRes, llmsRes, wellKnownList, agentList] = await Promise.all([
    get('/robots.txt', { accept: 'text/plain,*/*' }),
    get(`/findable-404-check-${Math.random().toString(36).slice(2, 10)}`, { readBody: false }),
    fetchUrl(page.url, { timeout, accept: 'text/markdown' }),
    get('/llms.txt', { accept: 'text/plain,text/markdown,*/*' }),
    Promise.all(Object.entries(WELL_KNOWN_PATHS).map(async ([key, path]) => [key, await get(path, { accept: 'application/json,*/*' })] as const)),
    Promise.all(Object.entries(AI_AGENT_UAS).map(async ([agent, ua]) => [agent, await fetchUrl(page.url, { timeout, ua, readBody: false })] as const)),
  ]);

  const robots = robotsRes.status === 200 && !/^\s*</.test(robotsRes.body) ? parseRobots(robotsRes.body) : null;

  const sitemapUrl = robots?.sitemaps[0] ?? new URL('/sitemap.xml', origin).href;
  const sitemapRes: FetchResult | null = await fetchUrl(sitemapUrl, { timeout, accept: 'application/xml,text/xml,*/*' });

  let linkStatuses: LinkStatus[] | null = null;
  let linksSkipped = 0;
  if (checkLinks) {
    const unique = [...new Set(links.map((l) => l.href))];
    const toCheck = unique.slice(0, maxLinks);
    linksSkipped = unique.length - toCheck.length;
    onProgress(`Checking ${toCheck.length} links`);
    linkStatuses = await mapLimit(toCheck, 8, async (href) => {
      let res = await fetchUrl(href, { method: 'HEAD', timeout: Math.min(timeout, 10_000) });
      // Plenty of servers reject HEAD; retry those with GET before calling the link broken.
      if (res.status === 0 || res.status === 403 || res.status === 405 || res.status === 501) {
        res = await fetchUrl(href, { timeout: Math.min(timeout, 10_000), readBody: false });
      }
      return { url: href, status: res.status, ...(res.error ? { error: res.error } : {}) };
    });
  }

  const ctx: ScanContext = {
    url,
    page,
    $,
    text: visibleText($),
    links,
    robotsRes,
    robots,
    sitemapRes,
    sitemapUrl,
    notFoundRes,
    markdownRes,
    llmsRes,
    wellKnown: Object.fromEntries(wellKnownList),
    agentStatuses: Object.fromEntries(agentList),
    linkStatuses,
    linksSkipped,
  };

  const checks = [...seoChecks, ...agentChecks].map((check) => check(ctx));
  const seo = scorePillar(checks, 'seo');
  const agent = scorePillar(checks, 'agent');
  const overall = Math.round((seo.score + agent.score) / 2);

  return {
    tool: { name: 'findable', version: VERSION },
    url: requested.href,
    finalUrl: page.url,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    overall: { score: overall, grade: grade(overall) },
    pillars: { seo, agent },
    checks,
    topFixes: topFixes(checks),
  };
}

function visibleText($: cheerio.CheerioAPI): string {
  const body = $('body').clone();
  body.find('script, style, noscript, template, svg, iframe').remove();
  return body.text().replace(/\s+/g, ' ').trim();
}

function extractLinks($: cheerio.CheerioAPI, pageUrl: string): LinkInfo[] {
  const base = new URL($('base[href]').attr('href') ?? pageUrl, pageUrl);
  const host = (h: string) => h.replace(/^www\./, '');
  const pageHost = host(new URL(pageUrl).hostname);
  const links: LinkInfo[] = [];

  $('a[href]').each((_, el) => {
    const $a = $(el);
    const raw = $a.attr('href')!.trim();
    if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel|sms|data):/i.test(raw)) return;
    let resolved: URL;
    try {
      resolved = new URL(raw, base);
    } catch {
      return;
    }
    if (!/^https?:$/.test(resolved.protocol)) return;
    resolved.hash = '';
    const text = ($a.text().replace(/\s+/g, ' ').trim() || $a.attr('aria-label') || $a.attr('title') || $a.find('img[alt]').attr('alt') || '').trim();
    links.push({
      href: resolved.href,
      text,
      internal: host(resolved.hostname) === pageHost,
      nofollow: /\bnofollow\b/i.test($a.attr('rel') ?? ''),
    });
  });
  return links;
}
