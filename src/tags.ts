/**
 * Detects analytics, advertising, marketing, consent and verification tags from raw
 * HTML and from public Google Tag Manager containers. Pure functions, so they are
 * easy to test; the scan feeds them the page body and any container bodies it fetched.
 */

export type TagCategory = 'Tag manager' | 'Analytics' | 'Advertising' | 'Marketing' | 'Consent' | 'Verification';
export type TagSource = 'page' | 'gtm';

export interface TagFinding {
  name: string;
  category: TagCategory;
  /** Measurement / account IDs found for this tag (GA4 G-…, Google Ads AW-…, GTM-…). */
  ids: string[];
  /** Where it was seen: hard-coded in the page, inside a GTM container, or both. */
  sources: TagSource[];
}

interface Vendor {
  name: string;
  category: TagCategory;
  pattern?: RegExp;
  /** Captures IDs. Group 1 must be the ID. Must use the g flag. */
  ids?: RegExp;
}

const VENDORS: Vendor[] = [
  // Tag managers
  { name: 'Google Tag Manager', category: 'Tag manager', ids: /\b(GTM-[A-Z0-9]{4,9})\b/g },
  { name: 'Adobe Launch', category: 'Tag manager', pattern: /assets\.adobedtm\.com/ },
  { name: 'Tealium', category: 'Tag manager', pattern: /tags\.tiqcdn\.com/ },

  // Analytics
  { name: 'Google Analytics 4', category: 'Analytics', ids: /(?:id=|["'])(G-[A-Z0-9]{6,12})\b/g },
  { name: 'Universal Analytics (retired)', category: 'Analytics', ids: /["'](UA-\d{4,10}-\d{1,4})["']/g },
  { name: 'Segment', category: 'Analytics', pattern: /cdn\.segment\.com|segment\.io\/analytics/ },
  { name: 'Microsoft Clarity', category: 'Analytics', pattern: /clarity\.ms/ },
  { name: 'Hotjar', category: 'Analytics', pattern: /static\.hotjar\.com|"__hjtc"/ },
  { name: 'Mixpanel', category: 'Analytics', pattern: /cdn\.mxpnl\.com|mixpanel\.init/ },
  { name: 'Amplitude', category: 'Analytics', pattern: /cdn\.amplitude\.com|amplitude\.getInstance|amplitude\.init/ },
  { name: 'Heap', category: 'Analytics', pattern: /heapanalytics\.com/ },
  { name: 'PostHog', category: 'Analytics', pattern: /posthog\.init|\.posthog\.com\/static/ },
  { name: 'FullStory', category: 'Analytics', pattern: /fullstory\.com\/s\/fs\.js|edge\.fullstory\.com/ },
  { name: 'Freshpaint', category: 'Analytics', pattern: /freshpaint/i },
  { name: 'Plausible', category: 'Analytics', pattern: /plausible\.io\/js/ },
  { name: 'Fathom', category: 'Analytics', pattern: /cdn\.usefathom\.com/ },
  { name: 'Matomo', category: 'Analytics', pattern: /matomo\.js|piwik\.js/ },
  { name: 'Contentsquare', category: 'Analytics', pattern: /t\.contentsquare\.net/ },
  { name: 'Quantum Metric', category: 'Analytics', pattern: /cdn\.quantummetric\.com/ },
  { name: 'Glassbox', category: 'Analytics', pattern: /glassboxdigital\.io|glassboxcdn\.com/ },
  { name: 'LogRocket', category: 'Analytics', pattern: /cdn\.logrocket\.io|cdn\.lr-ingest\.(?:io|com)/ },
  { name: 'Mouseflow', category: 'Analytics', pattern: /cdn\.mouseflow\.com/ },
  { name: 'Crazy Egg', category: 'Analytics', pattern: /script\.crazyegg\.com/ },
  { name: 'Lucky Orange', category: 'Analytics', pattern: /tools\.luckyorange\.com/ },
  { name: 'Optimizely', category: 'Analytics', pattern: /cdn\.optimizely\.com/ },
  { name: 'VWO', category: 'Analytics', pattern: /dev\.visualwebsiteoptimizer\.com/ },
  { name: 'AB Tasty', category: 'Analytics', pattern: /try\.abtasty\.com/ },

  // Advertising
  { name: 'Google Ads', category: 'Advertising', ids: /\b(AW-\d{6,12})\b/g },
  { name: 'Meta Pixel', category: 'Advertising', pattern: /connect\.facebook\.net\/[^"']*fbevents|fbq\(\s*["']init/ },
  { name: 'LinkedIn Insight', category: 'Advertising', pattern: /snap\.licdn\.com|_linkedin_partner_id/ },
  { name: 'Microsoft Ads (UET)', category: 'Advertising', pattern: /bat\.bing\.com/ },
  { name: 'TikTok Pixel', category: 'Advertising', pattern: /analytics\.tiktok\.com/ },
  { name: 'X (Twitter) Pixel', category: 'Advertising', pattern: /static\.ads-twitter\.com/ },
  { name: 'Pinterest Tag', category: 'Advertising', pattern: /s\.pinimg\.com\/ct\/core\.js|pintrk\(/ },
  { name: 'Reddit Pixel', category: 'Advertising', pattern: /redditstatic\.com\/ads/ },
  { name: 'Snap Pixel', category: 'Advertising', pattern: /sc-static\.net\/scevent/ },
  { name: 'Criteo', category: 'Advertising', pattern: /static\.criteo\.net/ },

  // Marketing / CRM
  { name: 'HubSpot', category: 'Marketing', pattern: /js\.hs-scripts\.com|js\.hs-analytics\.net/ },
  { name: 'Marketo', category: 'Marketing', pattern: /munchkin\.marketo\.net/ },
  { name: 'Intercom', category: 'Marketing', pattern: /widget\.intercom\.io/ },
  { name: 'Drift', category: 'Marketing', pattern: /js\.driftt\.com/ },
  { name: 'Klaviyo', category: 'Marketing', pattern: /static\.klaviyo\.com/ },
  { name: 'Pardot', category: 'Marketing', pattern: /pi\.pardot\.com/ },

  // Consent
  { name: 'OneTrust', category: 'Consent', pattern: /cdn\.cookielaw\.org|optanon/i },
  { name: 'Cookiebot', category: 'Consent', pattern: /consent\.cookiebot\.com/ },
  { name: 'Osano', category: 'Consent', pattern: /cmp\.osano\.com/ },
  { name: 'Didomi', category: 'Consent', pattern: /sdk\.privacy-center\.org/ },
  { name: 'Usercentrics', category: 'Consent', pattern: /usercentrics\.eu/ },
  { name: 'TrustArc', category: 'Consent', pattern: /consent\.trustarc\.com/ },
  { name: 'Termly', category: 'Consent', pattern: /app\.termly\.io/ },
  { name: 'CookieYes', category: 'Consent', pattern: /cdn-cookieyes\.com/ },
  { name: 'iubenda', category: 'Consent', pattern: /iubenda\.com\/cs/ },
  { name: 'Axeptio', category: 'Consent', pattern: /static\.axept\.io/ },
  { name: 'Quantcast Choice', category: 'Consent', pattern: /cmp\.quantcast\.com|quantcast\.mgr\.consensu\.org/ },
  { name: 'CookieFirst', category: 'Consent', pattern: /consent\.cookiefirst\.com/ },
  { name: 'Sourcepoint', category: 'Consent', pattern: /sourcepoint\.mgr\.consensu\.org|cdn\.privacy-mgmt\.com/ },
  { name: 'Complianz', category: 'Consent', pattern: /complianz/i },
  { name: 'Finsweet Cookie Consent', category: 'Consent', pattern: /fs-cc|@finsweet\/cookie-consent/ },
  { name: 'Google Consent Mode', category: 'Consent', pattern: /gtag\(\s*["']consent["']\s*,\s*["']default["']/ },
];

/** Hand-built consent handling, e.g. window.siteConsent or a cookie-consent banner script. Page only. */
const CUSTOM_CONSENT =
  /window\.\w*[Cc]onsent\b|hasOptedOut|cookie[-_]?consent|consentGranted|document\.cookie[^<]{0,200}consent|consent[\w.\\-]{0,30}=[^<]{0,200}document\.cookie/i;

/** Verification tags are meta tags, so they only count when found in the page itself. */
const VERIFICATION: { name: string; pattern: RegExp }[] = [
  { name: 'Google Search Console', pattern: /<meta[^>]+name=["']google-site-verification["']/i },
  { name: 'Bing Webmaster Tools', pattern: /<meta[^>]+name=["']msvalidate\.01["']/i },
  { name: 'Meta domain verification', pattern: /<meta[^>]+name=["']facebook-domain-verification["']/i },
  { name: 'Pinterest', pattern: /<meta[^>]+name=["']p:domain_verify["']/i },
  { name: 'Yandex Webmaster', pattern: /<meta[^>]+name=["']yandex-verification["']/i },
];

export function detectTags(html: string, containers: Record<string, string> = {}): TagFinding[] {
  const found = new Map<string, TagFinding>();
  const record = (vendor: { name: string; category: TagCategory }, source: TagSource, ids: string[] = []) => {
    const f = found.get(vendor.name) ?? { name: vendor.name, category: vendor.category, ids: [], sources: [] };
    for (const id of ids) if (!f.ids.includes(id)) f.ids.push(id);
    if (!f.sources.includes(source)) f.sources.push(source);
    found.set(vendor.name, f);
  };

  const scanText = (text: string, source: TagSource) => {
    for (const v of VENDORS) {
      if (v.ids) {
        const ids = [...text.matchAll(v.ids)].map((m) => m[1]!);
        // A container always names itself; that alone does not mean GTM is "inside" GTM.
        const own = source === 'gtm' && v.name === 'Google Tag Manager';
        if (ids.length && !own) record(v, source, ids);
      } else if (v.pattern!.test(text)) {
        record(v, source);
      }
    }
  };

  scanText(html, 'page');
  if (![...found.values()].some((f) => f.category === 'Consent') && CUSTOM_CONSENT.test(html)) {
    record({ name: 'Custom consent code', category: 'Consent' }, 'page');
  }
  for (const body of Object.values(containers)) scanText(body, 'gtm');
  for (const v of VERIFICATION) if (v.pattern.test(html)) record({ name: v.name, category: 'Verification' }, 'page');

  const order: TagCategory[] = ['Tag manager', 'Analytics', 'Advertising', 'Marketing', 'Consent', 'Verification'];
  return [...found.values()].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

/** GTM container IDs referenced by the page, so their public containers can be fetched. */
export function gtmContainerIds(html: string): string[] {
  // The standard snippet passes the ID as a separate argument rather than in the gtm.js URL,
  // so take every GTM ID on a page that loads GTM at all.
  if (!/googletagmanager\.com\/(gtm\.js|ns\.html)/.test(html)) return [];
  return [...new Set([...html.matchAll(/\b(GTM-[A-Z0-9]{4,9})\b/g)].map((m) => m[1]!))];
}

/** Number of Custom HTML tags in a GTM container (arbitrary scripts that need their own review). */
export function customHtmlTagCount(container: string): number {
  return (container.match(/"function":"__html"/g) ?? []).length;
}
