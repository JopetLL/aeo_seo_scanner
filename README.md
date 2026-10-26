# findable

**Is your page findable by search engines *and* AI agents?**

`findable` scans a URL and scores it on two things at once:

- **SEO**: the on-page fundamentals (titles, H1s, canonicals, links, structured data and more).
- **AI agent readiness**: whether ChatGPT, Claude, Perplexity and browser agents can reach, read and cite the page.

You get a 0–100 score and a letter grade for each, a list of the highest-impact fixes, and the evidence behind every result. Run it in a terminal, pipe the JSON into a script, or produce a shareable HTML report.

```
$ npx findable example.com

  findable v0.1.0  https://example.com/

  Overall   53/100  F · Poor
  SEO       59/100  ████████████░░░░░░░░  F  11/20 passed
  Agents    47/100  █████████░░░░░░░░░░░  F  3/8 passed
  …
  Top fixes
   1. H1 heading (SEO, essential)
      Add one H1 that states what the page is about.
   2. Content in the initial HTML (Agents, essential)
      Put the main content in the HTML response itself; agents skip content that is loaded later or missing.
   3. Canonical URL (SEO, recommended)
      Add <link rel="canonical" href="…"> with the absolute preferred URL.
```

## Why

Agent-readiness scanners such as [Is Agentic](https://is-agentic.com) and Cloudflare's [isitagentready.com](https://isitagentready.com) check whether AI agents can use a site. SEO auditors check whether Google can rank it. In practice they're the same job: the page needs to be crawlable, server-rendered, well-structured and clearly labelled. `findable` checks both in one pass, runs locally with no account or API key, and works as a CI gate.

## Install

Requires Node 20 or later.

```sh
npx findable <url>          # run without installing
npm install -g findable     # or install the command globally
```

## Usage

```sh
findable example.com                        # terminal report
findable https://example.com/pricing --html # also write findable-example.com.html
findable example.com --json | jq .overall   # machine-readable
findable example.com --fail-under 80        # exit 1 below 80, for CI
```

| Option | |
|---|---|
| `--json` | Print the full report as JSON |
| `--html` | Also write a self-contained HTML report |
| `--out <file>` | HTML report path (default `findable-<host>.html`) |
| `--no-links` | Skip checking whether links resolve (faster) |
| `--max-links <n>` | Check at most *n* links (default 50) |
| `--timeout <ms>` | Per-request timeout (default 15000) |
| `--fail-under <n>` | Exit with code 1 if the overall score is below *n* |
| `-v`, `--verbose` | Show every evidence line |

Exit codes: `0` success, `1` below `--fail-under`, `2` the page could not be scanned.

## What it checks

### SEO

| Category | Check | Tier |
|---|---|---|
| Crawlability | HTTP 200 · HTTPS · noindex (meta and `X-Robots-Tag`) · Googlebot/Bingbot allowed by robots.txt | Essential |
| | Redirect chain length · canonical tag (present, absolute, self-referencing) | Recommended |
| Metadata | `<title>` present and 30–60 chars | Essential |
| | Meta description 70–160 chars · `lang` · viewport · Open Graph | Recommended |
| | Twitter/X card · favicon | Minor |
| Content | Exactly one non-empty H1 | Essential |
| | 300+ words · image alt coverage | Recommended |
| | Heading hierarchy with no skipped levels | Minor |
| Links | Internal link count · broken links (HEAD, falling back to GET) | Recommended |
| | Empty or generic anchor text ("click here", "learn more") | Minor |
| Structured data | Valid JSON-LD, with the schema types listed | Recommended |
| Performance | Response time · HTML size | Minor |

### AI agent readiness

| Category | Check | Tier |
|---|---|---|
| Access | robots.txt rules for AI **search and answer** agents (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot…) | Essential |
| | The page actually returns 200 to AI user-agents, which catches WAF/CDN bot blocking | Essential |
| | Unknown URLs return 404, not a soft 404 | Recommended |
| Understanding | Main content is in the initial HTML, without running JavaScript; empty app shells are detected | Essential |
| | `<main>` and other landmarks · citation metadata (canonical, title, publisher, language, image) · labelled form controls and buttons | Recommended |
| Discovery | robots.txt · XML sitemap | Recommended |
| Emerging | `llms.txt` · Markdown via `Accept: text/markdown` · Content Signals · API catalog (RFC 9727) · MCP / agent-skill discovery under `/.well-known/` | Bonus |

Blocking **training** crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot…) is reported but never penalised. It's a legitimate business decision, and it doesn't stop a site from being cited in AI answers.

## Scoring

Each pillar is a weighted share of the points available:

- **Essential** checks are worth 3, **recommended** 2 and **minor** 1.
- A **pass** earns full credit, a **warning** half credit and a **fail** none.
- Checks that don't apply (no images, no forms) are left out rather than counted as passes or failures.
- **Bonus** checks for emerging standards add 1 point each, up to +5. Their absence never lowers a score, because adoption is still early and their impact is unproven.

The overall score is the average of the SEO and Agents scores.

| Score | Grade |
|---|---|
| 95–100 | A+ · Excellent |
| 90–94 | A · Excellent |
| 80–89 | B · Good |
| 70–79 | C · Fair |
| 60–69 | D · Needs work |
| < 60 | F · Poor |

**Top fixes** ranks the failing and warning checks by their potential impact, so essential failures come first.

## Limitations

- It scans one public URL, as a snapshot. Pages behind a login, results that vary by region, and content added by JavaScript after load are out of scope by design, because most agents can't see those either.
- AI user-agent tests send the published UA strings from a regular IP address. Some firewalls verify bot IP ranges, so a block reported here may not affect the real agent. The report says so when this applies.
- External links that refuse scripted requests (social networks often do) are marked *unverified*, not broken.
- A score is a prioritised technical review. It isn't a ranking guarantee or an accessibility audit.

## Development

```sh
npm install
npm run dev -- example.com   # run from source (Node 22.6+ strips the TypeScript types)
npm test                     # unit tests (node:test)
npm run build                # compile to dist/
```

The code lives in `src/`. Each check is a small synchronous function in `checks/seo.ts` or `checks/agent.ts` that reads from a `ScanContext`, which `scan.ts` gathers up front, mostly in parallel requests. `robots.ts` is a standalone robots.txt parser that follows RFC 9309 and Google's matching rules.

## License

MIT
