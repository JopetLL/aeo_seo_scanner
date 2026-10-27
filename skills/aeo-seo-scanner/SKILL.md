---
name: aeo-seo-scanner
description: Scan any web page for SEO and AEO (answer engine optimisation / AI-agent readiness) and score it 0–100 with a letter grade, top fixes and evidence. Use whenever the user asks to scan, audit, check, grade or score a URL or page for SEO, AEO, GEO, AI visibility, agent readiness, "can ChatGPT/Claude/Perplexity read this page", llms.txt, robots.txt AI-bot rules, titles, H1s, canonicals, meta descriptions, structured data or broken links — including "run the scanner on X", "how does this page score", "compare our page with competitor Y", or a pasted URL with "check this". Also use for comparing several pages or competitors side by side. Do NOT use for keyword research, rankings or traffic (those need Search Console or Semrush data), or for site-wide crawls of thousands of pages.
---

# AEO + SEO scanner

Runs the `aeo_seo_scanner` CLI against one or more URLs. Each scan fetches the page the
way a crawler does (raw HTML, no JavaScript), plus robots.txt, the sitemap, llms.txt,
`/.well-known/` files, a deliberately missing URL, a Markdown version of the page, and
the page again under ChatGPT, Claude, Perplexity and GPTBot user-agents. 37 checks are
then scored into an **SEO** score and an **Agents** (AEO) score; the overall score is
their average.

## Running a scan

```bash
scripts/scan.sh <url> --json [--no-links] [--html --out <file>]
```

The script finds the scanner next to this skill and builds it on first run. Always pass
`--json` so you read structured results rather than parsing coloured terminal text.

- **One page:** run with `--json` and also `--html --out <file>` so a full report exists.
  Write the HTML into the session's scratchpad directory if it has one, otherwise `/tmp`.
- **Several pages or competitors:** run them in parallel (separate Bash calls in one
  message) with `--json --no-links`. Link checking is the slow part and rarely changes a
  comparison.
- A scan takes 2–10 seconds. Exit code `2` means the page could not be fetched; report
  the error message and stop for that URL.
- Use `--no-links` when the user wants speed, or when the page has hundreds of links.

## Presenting results

Lead with the scores, then what to do. Keep it scannable:

1. **Scores:** overall, SEO and Agents, each with its letter grade. Mention the bonus
   points if there were any.
2. **Top fixes:** use the report's `topFixes` order (it is already ranked by impact).
   For each, say what is wrong *on this page*, using the evidence in `details` (the actual
   title text, the two H1s, the blocked agent), not just the generic fix line.
3. **What's already good:** one line on notable passes (for example, server-rendered
   content, AI agents allowed, valid JSON-LD with the types found).
4. For comparisons, use one table: a row per URL and columns for Overall, SEO, Agents
   and the 2–3 checks that differ most between the pages. Then say who leads and why.

Then publish the HTML report as an Artifact when the user wants to see, keep or share
the report; otherwise offer it in one line. The file is a complete, self-contained page
that already handles light and dark mode.

## Reading results correctly

Some results need judgement before you repeat them as problems. Check the evidence first.

- **AI user-agents refused (`ai-ua-access`):** the scanner sends the published user-agent
  strings from an ordinary IP address. Firewalls that verify bots by IP range may block
  this test while letting the real agent through. Present it as "worth checking in your
  CDN/WAF bot settings", not as a confirmed block.
- **Training crawlers blocked** (GPTBot, ClaudeBot, Google-Extended, CCBot…) is a policy
  choice and is deliberately not scored. Only blocked *search and answer* agents
  (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot) cost points.
- **Unverified links** are external sites (often social networks) that refuse scripted
  requests. They are not broken links.
- **Multiple H1s / skipped heading levels** are common on visual landing pages built in
  page builders. They are real but low-impact; don't lead with them unless there's
  nothing more serious.
- **Content in the initial HTML** failing means the page relies on JavaScript to show its
  content. That is a major AEO problem, because most AI agents never run JavaScript. If
  it fails, lead with it.
- **Bonus checks** (llms.txt, Markdown negotiation, Content Signals, API catalog, MCP
  discovery) can only add points. Never present their absence as a problem; at most
  mention them as optional extras.
- **Labelled controls** ignores controls hidden with `aria-hidden`. If a result still
  looks wrong, fetch the page with `curl` and inspect the element before reporting it.

If a result is a false positive, say so plainly, and tell the user it may be a scanner
bug worth fixing in the `aeo_seo_scanner` repo.

## Limits to state when relevant

- One URL per scan, as a snapshot. It does not crawl a whole site, and it cannot see
  pages behind a login.
- It reads raw HTML on purpose, so content added by JavaScript after load does not count.
- A score is a prioritised technical review, not a ranking guarantee.
