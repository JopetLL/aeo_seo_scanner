/**
 * A small robots.txt parser following RFC 9309 and Google's documented behaviour:
 * the most specific user-agent group wins (falling back to `*`), groups naming the
 * same agent are merged, the longest matching rule wins, and Allow wins a tie.
 */

export interface RobotsRule {
  allow: boolean;
  pattern: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

export interface Robots {
  groups: RobotsGroup[];
  sitemaps: string[];
  /** Cloudflare Content Signals, e.g. `search=yes, ai-train=no`. */
  contentSignals: string[];
}

export interface RobotsVerdict {
  allowed: boolean;
  /** The user-agent the decision came from: the specific token, `*`, or null when no group applied. */
  matchedAgent: string | null;
  rule?: RobotsRule;
}

export function parseRobots(text: string): Robots {
  const robots: Robots = { groups: [], sitemaps: [], contentSignals: [] };
  let current: RobotsGroup | null = null;
  let lastLineWasAgent = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === 'user-agent') {
      // Consecutive User-agent lines share one group; a User-agent after rules starts a new one.
      if (!current || !lastLineWasAgent) {
        current = { agents: [], rules: [] };
        robots.groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }
    lastLineWasAgent = false;

    if ((key === 'allow' || key === 'disallow') && current) {
      // An empty Disallow means "allow everything", which is the default anyway.
      if (value === '') continue;
      current.rules.push({ allow: key === 'allow', pattern: value });
    } else if (key === 'sitemap') {
      robots.sitemaps.push(value);
    } else if (key === 'content-signal') {
      robots.contentSignals.push(value);
    }
  }
  return robots;
}

export function isAllowed(robots: Robots, token: string, path: string): RobotsVerdict {
  const wanted = token.toLowerCase();
  let groups = robots.groups.filter((g) => g.agents.some((a) => a.split('/')[0]!.trim() === wanted));
  let matchedAgent: string | null = token;
  if (groups.length === 0) {
    groups = robots.groups.filter((g) => g.agents.includes('*'));
    matchedAgent = groups.length ? '*' : null;
  }

  let best: RobotsRule | undefined;
  for (const rule of groups.flatMap((g) => g.rules)) {
    if (!patternMatches(rule.pattern, path)) continue;
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
    ) {
      best = rule;
    }
  }
  return { allowed: best ? best.allow : true, matchedAgent, rule: best };
}

function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  let source = '^';
  for (const ch of body) source += ch === '*' ? '.*' : ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  if (anchored) source += '$';
  return new RegExp(source).test(path);
}
