/**
 * Decides whether the page the scanner fetched is really the site, or something standing
 * in front of it: an HTTP error, a bot-protection challenge, or a JavaScript redirect stub.
 * When it isn't the site, every other check is grading the wrong page, so the report must
 * say so instead of presenting the score as the site's real score.
 */

export type AccessProblem = 'http-error' | 'bot-challenge' | 'js-redirect';

export interface AccessWarning {
  kind: AccessProblem;
  status: number;
  /** Bot-protection vendor, when recognisable (Cloudflare, DataDome…). */
  vendor?: string;
  /** Where a JavaScript redirect stub points. */
  target?: string;
  message: string;
}

const VENDORS: { name: string; pattern: RegExp }[] = [
  { name: 'Cloudflare', pattern: /<title>\s*(?:Just a moment\.\.\.|Attention Required! \| Cloudflare)|cf_chl_opt|\/cdn-cgi\/challenge-platform|cf-error-details/i },
  { name: 'DataDome', pattern: /captcha-delivery\.com|datadome/i },
  { name: 'HUMAN (PerimeterX)', pattern: /px-captcha|_pxAppId|perimeterx/i },
  { name: 'Akamai', pattern: /<title>\s*Access Denied\s*<\/title>[\s\S]*Reference(?:&#32;|\s)(?:&#35;|#)|errors\.edgesuite\.net/i },
  { name: 'Imperva (Incapsula)', pattern: /_Incapsula_Resource|Incapsula incident/i },
  { name: 'Sucuri', pattern: /Sucuri WebSite Firewall|sucuri\.net\/privacy-policy/i },
  { name: 'AWS WAF', pattern: /awswaf|aws-waf-token/i },
  { name: 'Vercel', pattern: /Vercel Security Checkpoint/i },
];

/** Wording challenge pages use when they have no recognisable vendor fingerprint. */
const GENERIC_CHALLENGE =
  /js_challenge|Checking your browser|Verifying you are human|verify you are (?:a )?human|Please enable JS and disable any ad blocker|enable JavaScript and cookies to continue/i;

const JS_REDIRECT = /(?:window\.|document\.|top\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']|location\.(?:replace|assign)\(\s*["']([^"']+)["']\s*\)/i;
const META_REFRESH = /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["']?\s*\d+\s*;\s*url=([^"'>\s]+)/i;

/** Pages with real content are never treated as challenges, even if they embed e.g. Turnstile. */
const THIN = 50;

export function assessAccess(status: number, html: string, words: number, headers?: Headers): AccessWarning | null {
  const vendor =
    VENDORS.find((v) => v.pattern.test(html))?.name ?? (headers?.get('x-datadome') ? 'DataDome' : undefined);
  const by = vendor ? ` by ${vendor}` : '';

  if (status >= 400) {
    const challenge = vendor || GENERIC_CHALLENGE.test(html);
    return {
      kind: 'http-error',
      status,
      ...(vendor ? { vendor } : {}),
      message: challenge
        ? `The page returned ${status}: the scanner was blocked${by}. These results describe the block page, not the site.`
        : `The page returned ${status}. These results describe the error page, not the site.`,
    };
  }

  if (words < THIN && (vendor || GENERIC_CHALLENGE.test(html))) {
    return {
      kind: 'bot-challenge',
      status,
      ...(vendor ? { vendor } : {}),
      message: `The page served a bot-protection challenge${by} instead of its content. These results describe the challenge page, not the site.`,
    };
  }

  if (words < 20) {
    const m = html.match(JS_REDIRECT) ?? html.match(META_REFRESH);
    const target = m?.[1] ?? m?.[2];
    if (target) {
      return {
        kind: 'js-redirect',
        status,
        target,
        message: `The page is a redirect stub that sends browsers to ${target} with JavaScript or a meta refresh. Crawlers and AI agents see the empty stub, so these results describe the stub, not the destination.`,
      };
    }
  }
  return null;
}

/** Short name for the page that was actually scored, e.g. "block page". */
export function scoredPageLabel(w: AccessWarning): string {
  if (w.kind === 'js-redirect') return 'redirect stub';
  if (w.kind === 'bot-challenge') return 'challenge page';
  return isBlock(w) ? 'block page' : 'error page';
}

const isBlock = (w: AccessWarning) => !!w.vendor || w.status === 401 || w.status === 403 || w.status === 429;

/** What to do instead of the usual top fixes, which would be about the wrong page. */
export function accessAdvice(w: AccessWarning): string {
  if (w.kind === 'js-redirect') {
    return `Replace the JavaScript redirect with a server-side 301/308 to ${w.target}, so crawlers and AI agents land on the real page. Then scan ${w.target} directly.`;
  }
  if (w.kind === 'bot-challenge' || isBlock(w)) {
    return 'If people see the site normally, its bot protection is blocking automated clients, which probably includes many AI agents too. Allow verified AI crawlers in the WAF/bot settings, or scan from an allow-listed network to grade the real page.';
  }
  return `Fix the ${w.status} response (or check the URL), then scan again.`;
}
