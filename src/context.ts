import type { CheerioAPI } from 'cheerio';
import type { FetchResult } from './fetcher.ts';
import type { Robots } from './robots.ts';
import type { TagFinding } from './tags.ts';

export interface LinkInfo {
  href: string;
  text: string;
  internal: boolean;
  nofollow: boolean;
}

export interface LinkStatus {
  url: string;
  status: number;
  error?: string;
}

/** Everything the checks need, gathered up front so the checks themselves stay synchronous. */
export interface ScanContext {
  url: URL;
  page: FetchResult;
  $: CheerioAPI;
  /** Visible body text, with scripts, styles and templates removed. */
  text: string;
  links: LinkInfo[];
  robotsRes: FetchResult;
  robots: Robots | null;
  sitemapRes: FetchResult | null;
  sitemapUrl: string | null;
  notFoundRes: FetchResult;
  markdownRes: FetchResult;
  llmsRes: FetchResult;
  wellKnown: Record<string, FetchResult>;
  /** Status the page returns to each AI user-agent, keyed by agent name. */
  agentStatuses: Record<string, FetchResult>;
  /** Null when link checking was turned off. */
  linkStatuses: LinkStatus[] | null;
  linksSkipped: number;
  /** Public Google Tag Manager containers referenced by the page, keyed by GTM ID. */
  gtmContainers: Record<string, FetchResult>;
  tags: TagFinding[];
}
