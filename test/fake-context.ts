import * as cheerio from 'cheerio';
import { seoChecks } from '../src/checks/seo.ts';
import { agentChecks } from '../src/checks/agent.ts';
import type { ScanContext } from '../src/context.ts';
import type { FetchResult } from '../src/fetcher.ts';
import type { CheckResult } from '../src/types.ts';

const response = (url: string, status: number, body = ''): FetchResult => ({
  requestedUrl: url,
  url,
  status,
  headers: new Headers({ 'content-type': 'text/html' }),
  body,
  bytes: body.length,
  hops: [],
  ms: 100,
});

/** A scan context for a page with the given HTML and otherwise neutral defaults. No network. */
export function fakeContext(html: string, url = 'https://example.com/'): ScanContext {
  const $ = cheerio.load(html);
  return {
    url: new URL(url),
    page: response(url, 200, html),
    $,
    text: $('body').text().replace(/\s+/g, ' ').trim(),
    links: [],
    robotsRes: response(`${url}robots.txt`, 404),
    robots: null,
    sitemapRes: null,
    sitemapUrl: null,
    notFoundRes: response(`${url}missing`, 404),
    markdownRes: response(url, 406),
    llmsRes: response(`${url}llms.txt`, 404),
    wellKnown: {},
    agentStatuses: {},
    linkStatuses: null,
    linksSkipped: 0,
    gtmContainers: {},
    tags: [],
  };
}

/** Run one check (by id) against a page. */
export function runCheck(id: string, html: string): CheckResult {
  const ctx = fakeContext(html);
  const result = [...seoChecks, ...agentChecks].map((check) => check(ctx)).find((c) => c.id === id);
  if (!result) throw new Error(`No check with id ${id}`);
  return result;
}
