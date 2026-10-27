/**
 * Plain-English explanations shown behind the "?" tooltips in the HTML report:
 * what each category and check looks at, and why it matters.
 */

export const CATEGORY_HELP: Record<string, string> = {
  Crawlability:
    'Whether search engines can reach and index this URL: status code, HTTPS, redirects, noindex, robots.txt and the canonical tag. If a page can’t be crawled or is marked noindex, nothing else matters, because it won’t rank.',
  Metadata:
    'The tags in the page’s <head> that search results, link previews and AI answers display: title, meta description, language, viewport, Open Graph and favicon. They decide how the page looks before anyone clicks.',
  Content:
    'The substance of the page: one clear H1, a logical heading outline, enough copy to answer the question, and alt text on images. Search engines rank, and AI models quote, what they can actually read.',
  Links:
    'Internal links let crawlers and agents discover your other pages and understand how they relate. Descriptive anchor text says what’s behind each link, and broken links waste crawl budget and dead-end visitors.',
  'Structured data':
    'JSON-LD schema that states facts in machine-readable form: who you are, what you sell, FAQs, breadcrumbs. It powers rich results in Google and gives AI answers reliable facts to cite.',
  'Tags & tracking':
    'Analytics, ad, marketing, consent and verification tags found in the HTML and inside public Google Tag Manager containers. Mostly informational; it flags retired Universal Analytics, GA4 installed twice, tracking with no consent manager, and heavy tag loads.',
  Performance:
    'How fast the server answers and how large the HTML is. Slow, heavy pages get crawled less often, and AI agents with tight time and context limits may give up or cut the page short.',
  Access:
    'Whether AI assistants are allowed and able to fetch the page: robots.txt rules for AI agents, firewalls that refuse AI user-agents, and real 404s for missing pages. An agent that can’t fetch a page can’t cite it.',
  Understanding:
    'Whether an agent can make sense of the page without running JavaScript: content in the raw HTML, landmarks like <main>, citation metadata and labelled controls. Most AI agents read the raw HTML and nothing else.',
  Discovery:
    'How crawlers and agents find the rest of your site: a robots.txt and an XML sitemap. Without them, discovery depends on links alone, and new or deep pages get found late.',
  Emerging:
    'Newer standards for AI agents: llms.txt, Markdown versions of pages, Content Signals, API catalogs and MCP discovery. Adoption is early and the impact is unproven, so they only add bonus points and never lower the score.',
};

/** Keyed by check id. */
export const CHECK_HELP: Record<string, string> = {
  // ── SEO: Crawlability
  'http-status':
    'The status code the page returns after redirects. Only a 200 gets indexed; 4xx and 5xx pages drop out of search results and look broken to agents.',
  https:
    'Whether the final URL is served over HTTPS. Google uses HTTPS as a ranking signal, browsers flag HTTP pages as “Not secure”, and many agents refuse plain HTTP.',
  redirects:
    'How many redirects happen before the page loads. One is normal (e.g. adding www). Each extra hop slows crawlers and visitors and can leak link equity, so chains of 2+ are flagged.',
  indexable:
    'Looks for noindex in the robots meta tag and the X-Robots-Tag header. A noindex page is removed from Google entirely, which is usually an accident left over from staging.',
  'robots-search':
    'Checks robots.txt rules for Googlebot and Bingbot on this exact path. If either is disallowed, the page can’t be crawled and won’t appear in Google or Bing (which also feeds ChatGPT search and Copilot).',
  canonical:
    'The <link rel="canonical"> tag tells search engines which URL is the “real” one when the same content is reachable at several (tracking parameters, trailing slashes). Missing or wrong canonicals split ranking signals.',

  // ── SEO: Metadata
  title:
    'The <title> tag is the blue headline in search results and the default name for bookmarks and AI citations. 30–60 characters fits without being cut off; put the main keyword first.',
  'meta-description':
    'The snippet under the headline in search results. It isn’t a ranking factor, but a clear 70–160 character summary wins clicks. Without one, Google writes its own from page text.',
  lang:
    'The lang attribute on <html> (e.g. lang="en") tells search engines, screen readers and AI models which language the page is in, so it’s matched to the right searches and translated correctly.',
  viewport:
    'The viewport meta tag makes the page scale properly on phones. Google indexes the mobile version of pages first, so a page without it is judged as a desktop page squeezed onto a phone.',
  'open-graph':
    'Open Graph tags (og:title, og:description, og:image, og:url) control the preview card when the link is shared on LinkedIn, Slack, iMessage and others, and many AI tools read them for previews too.',
  'twitter-card':
    'The twitter:card tag sets how links look when shared on X. summary_large_image shows a big image. Minor, but cheap to add.',
  favicon:
    'The small site icon declared with <link rel="icon">. Google shows it beside your result on mobile, and AI answers show it next to citations. A missing one looks unfinished.',

  // ── SEO: Content
  h1:
    'The main heading on the page. Exactly one, with real text, tells search engines and agents what the page is about. Multiple H1s blur the topic; none leaves them guessing.',
  'heading-order':
    'Whether headings nest in order (H2 under H1, H3 under H2) without skipping levels. A clean outline helps search engines and AI models split the page into sections and quote the right part.',
  'word-count':
    'Visible words in the HTML, excluding scripts and styles. Pages under ~300 words rarely rank for anything competitive and give AI answers little to quote.',
  'image-alt':
    'Share of images with an alt attribute. Alt text is how search engines and AI understand images, powers Google Images rankings, and is required for screen readers. Use alt="" for purely decorative images.',

  // ── SEO: Links
  'internal-links':
    'Links to other pages on the same site. They’re how crawlers and agents discover the rest of your site and how ranking strength flows between pages. Fewer than 3 is flagged.',
  'anchor-text':
    'Links whose text is empty or generic (“click here”, “learn more”). Descriptive anchor text tells search engines what the target page is about; icon-only links need an aria-label.',
  'broken-links':
    'Requests each link on the page (up to 50) and flags 4xx/5xx responses. Broken links waste crawl budget and strand visitors and agents. Social sites that block scripts are marked unverified, not broken.',

  // ── SEO: Structured data
  'structured-data':
    'Parses every JSON-LD block and lists the schema types found (Organization, Product, FAQPage…). Valid schema unlocks rich results in Google and gives AI answers facts it can trust. One syntax error invalidates the whole block.',

  // ── SEO: Tags & tracking
  tags:
    'An inventory of analytics, advertising, marketing, consent and verification tools found in the HTML and inside any public Google Tag Manager container. Informational only, and useful for seeing a competitor’s stack.',
  'tags-legacy-ua':
    'Looks for Universal Analytics IDs (UA-…). Google shut UA down in July 2024, so these tags load code and send data nowhere. They’re dead weight to remove.',
  'tags-duplicate-ga4':
    'Whether GA4 is hard-coded in the page and also configured in GTM. If both fire for the same property, every session and event is counted twice and your analytics are inflated.',
  'tags-consent':
    'Whether a consent tool (OneTrust, Cookiebot, Consent Mode or custom code) is present when tracking tags are. Without one, tags may fire before visitors agree, a legal risk under GDPR and some US state laws.',
  'tags-weight':
    'Flags pages with 8+ tracking vendors or a GTM container over 500 KB. Every tag adds download and script time, which slows the page for visitors and can hurt Core Web Vitals.',

  // ── SEO: Performance
  'response-time':
    'Time to fetch the HTML, including redirects. Under 800 ms is good. Slow servers get crawled less often, and AI agents fetching pages live may time out before your page arrives.',
  'html-size':
    'Size of the raw HTML. Under 500 KB is good. Bloated HTML (inlined scripts, hydration data) slows crawling and can push your real content past the point where AI agents stop reading.',

  // ── Agents: Access
  'ai-robots':
    'Checks robots.txt for AI search and answer agents (OAI-SearchBot, ChatGPT-User, Claude-User, PerplexityBot…). Blocking them stops your page being fetched and cited in AI answers. Blocking training crawlers like GPTBot is a policy choice and isn’t scored.',
  'ai-ua-access':
    'Requests the page as ChatGPT, Claude, Perplexity and GPTBot and compares the result. A firewall or CDN that refuses AI user-agents blocks them even when robots.txt allows them. Some firewalls verify real bots by IP, so a block here is worth confirming.',
  'soft-404':
    'Requests a URL that can’t exist. A proper site returns 404. Sites that return 200 or redirect to the homepage create “soft 404s”: junk pages get indexed and agents can’t tell a dead link from real content.',

  // ── Agents: Understanding
  'server-rendered':
    'Counts the words in the HTML before any JavaScript runs. Most AI agents (and many crawlers on a first pass) never run JavaScript, so a page that builds its content in the browser looks empty to them.',
  landmarks:
    'Looks for semantic HTML landmarks like <main>, <nav>, <header> and <footer>. <main> tells agents where the real content is, so they can skip menus and boilerplate when summarising or quoting.',
  'citation-metadata':
    'The details an AI answer needs to cite you properly: a canonical URL, a title, a site or publisher name, the page language and a preview image. Missing pieces mean weaker or wrong attribution.',
  'labelled-controls':
    'Whether every form field and button has an accessible name (a label, aria-label or visible text). Browser agents that fill forms or click buttons find controls by name, the same way screen readers do.',

  // ── Agents: Discovery
  'robots-txt':
    'Whether /robots.txt exists and is valid. It’s where you state your crawler and AI-bot policy and point to your sitemap. If it errors (5xx), Google treats the whole site as off-limits.',
  sitemap:
    'Whether an XML sitemap exists, ideally declared in robots.txt with a Sitemap: line. It lists your pages so crawlers and agents can find new and deep pages without relying on links.',

  // ── Agents: Emerging (bonus)
  'llms-txt':
    'A proposed /llms.txt file: a Markdown index of your most useful pages written for language models. Few agents read it yet, so it’s a bonus, not a requirement.',
  markdown:
    'Whether the page returns a clean Markdown version when asked with Accept: text/markdown. Markdown is far cheaper for agents to read than HTML, so they get more of your content within their limits.',
  'content-signals':
    'Content-Signal lines in robots.txt (a Cloudflare proposal) that state how content may be used: search=yes, ai-input=yes, ai-train=no. They express intent more precisely than allow/disallow.',
  'api-catalog':
    'An RFC 9727 API catalog at /.well-known/api-catalog, or Link headers pointing to API docs. It lets agents discover and use your API directly instead of scraping pages. Relevant for products with an API.',
  mcp:
    'Discovery files under /.well-known/ for MCP servers, AI catalogs and agent skills. They let AI assistants find tools you offer and connect to them. Relevant if you run an MCP server.',
};
