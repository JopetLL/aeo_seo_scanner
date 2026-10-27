#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import pc from 'picocolors';
import { scan, ScanError, VERSION } from './scan.ts';
import { renderTerminal } from './report/terminal.ts';
import { renderHtml } from './report/html.ts';

const HELP = `
  ${pc.bold('aeo_seo_scanner')} — score a web page for SEO and AI-agent readiness

  ${pc.bold('Usage')}
    aeo_seo_scanner <url> [options]

  ${pc.bold('Options')}
    --json               Print the full report as JSON
    --html               Also write a shareable HTML report
    --out <file>         HTML report path (default: aeo_seo_scanner-<host>.html)
    --no-links           Skip checking whether links resolve
    --max-links <n>      Check at most n links (default 50)
    --timeout <ms>       Per-request timeout (default 15000)
    --fail-under <n>     Exit with code 1 if the overall score is below n (for CI)
    -v, --verbose        Show every detail line
    -h, --help           Show this help
    --version            Show the version

  ${pc.bold('Examples')}
    aeo_seo_scanner example.com
    aeo_seo_scanner https://example.com/pricing --html
    aeo_seo_scanner example.com --json --no-links | jq .overall
    aeo_seo_scanner example.com --fail-under 80
`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      html: { type: 'boolean', default: false },
      out: { type: 'string' },
      'no-links': { type: 'boolean', default: false },
      'max-links': { type: 'string', default: '50' },
      timeout: { type: 'string', default: '15000' },
      'fail-under': { type: 'string' },
      verbose: { type: 'boolean', short: 'v', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', default: false },
    },
  });

  if (values.version) {
    console.log(VERSION);
    return 0;
  }
  const target = positionals[0];
  if (values.help || !target) {
    console.log(HELP);
    return values.help ? 0 : 2;
  }

  const spinner = !values.json && process.stderr.isTTY;
  const report = await scan(target, {
    checkLinks: !values['no-links'],
    maxLinks: Number(values['max-links']),
    timeout: Number(values.timeout),
    onProgress: (msg) => spinner && process.stderr.write(`\r\x1b[2K  ${pc.dim(msg)}…`),
  });
  if (spinner) process.stderr.write('\r\x1b[2K');

  if (values.json) console.log(JSON.stringify(report, null, 2));
  else console.log(renderTerminal(report, { verbose: values.verbose }));

  if (values.html || values.out) {
    const file = values.out ?? `aeo_seo_scanner-${new URL(report.finalUrl).hostname}.html`;
    await writeFile(file, renderHtml(report));
    if (!values.json) console.log(`  HTML report written to ${pc.underline(file)}\n`);
  }

  const threshold = values['fail-under'] === undefined ? undefined : Number(values['fail-under']);
  if (threshold !== undefined && report.overall.score < threshold) {
    if (!values.json) console.error(pc.red(`  Score ${report.overall.score} is below --fail-under ${threshold}\n`));
    return 1;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(pc.red(`\n  ${err instanceof ScanError ? err.message : (err as Error).stack}\n`));
    process.exit(2);
  },
);
