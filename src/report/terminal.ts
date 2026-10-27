import pc from 'picocolors';
import type { CheckResult, PillarScore, Report, Status } from '../types.ts';

const ICON: Record<Status, string> = {
  pass: pc.green('✔'),
  warn: pc.yellow('▲'),
  fail: pc.red('✖'),
  info: pc.dim('·'),
};

const colourFor = (score: number) => (score >= 80 ? pc.green : score >= 60 ? pc.yellow : pc.red);

function bar(score: number, width = 20): string {
  const filled = Math.round((score / 100) * width);
  return colourFor(score)('█'.repeat(filled)) + pc.dim('░'.repeat(width - filled));
}

function pillarLine(name: string, p: PillarScore): string {
  const bonus = p.bonus ? pc.dim(` (+${p.bonus} bonus)`) : '';
  return `  ${name.padEnd(8)} ${colourFor(p.score)(String(p.score).padStart(3))}${pc.dim('/100')}  ${bar(p.score)}  ${p.grade.letter.padEnd(2)} ${pc.dim(`${p.passed}/${p.total} passed`)}${bonus}`;
}

function checkLine(c: CheckResult, verbose: boolean): string[] {
  const tier = c.tier === 'essential' ? pc.dim(' ●') : '';
  const lines = [`   ${ICON[c.status]} ${c.title.padEnd(32)}${c.status === 'info' ? pc.dim(c.summary) : c.summary}${tier}`];
  const showDetails = verbose || c.status === 'fail' || c.status === 'warn';
  if (showDetails && c.details) {
    for (const d of c.details.slice(0, verbose ? 20 : 3)) lines.push(pc.dim(`       ${d}`));
    if (!verbose && c.details.length > 3) lines.push(pc.dim(`       …and ${c.details.length - 3} more (use --verbose)`));
  }
  return lines;
}

export function renderTerminal(report: Report, { verbose = false } = {}): string {
  const out: string[] = [];
  const { overall, pillars } = report;

  out.push('');
  out.push(`  ${pc.bold('aeo_seo_scanner')} ${pc.dim(`v${report.tool.version}`)}  ${pc.underline(report.finalUrl)}`);
  out.push('');
  out.push(`  ${pc.bold('Overall')}  ${colourFor(overall.score)(pc.bold(String(overall.score).padStart(3)))}${pc.dim('/100')}  ${pc.bold(overall.grade.letter)} · ${overall.grade.label}`);
  out.push(pillarLine('SEO', pillars.seo));
  out.push(pillarLine('Agents', pillars.agent));

  for (const [pillar, heading] of [['seo', 'SEO'], ['agent', 'AI agent readiness']] as const) {
    out.push('');
    out.push(pc.bold(`  ${heading}`));
    let category = '';
    for (const c of report.checks.filter((c) => c.pillar === pillar)) {
      if (c.category !== category) {
        category = c.category;
        out.push(pc.cyan(`  ${category}${c.tier === 'bonus' ? pc.dim(' (bonus: can only add points)') : ''}`));
      }
      out.push(...checkLine(c, verbose));
    }
  }

  if (report.topFixes.length) {
    out.push('');
    out.push(pc.bold('  Top fixes'));
    report.topFixes.forEach((c, i) => {
      out.push(`   ${i + 1}. ${pc.bold(c.title)} ${pc.dim(`(${c.pillar === 'seo' ? 'SEO' : 'Agents'}, ${c.tier})`)}`);
      out.push(`      ${c.fix}`);
    });
  }

  out.push('');
  out.push(pc.dim(`  ● = essential check · scanned in ${(report.durationMs / 1000).toFixed(1)}s`));
  out.push('');
  return out.join('\n');
}
