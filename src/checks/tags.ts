import { customHtmlTagCount } from '../tags.ts';
import type { ScanContext } from '../context.ts';
import type { TagFinding } from '../tags.ts';
import type { CheckResult, Status, Tier } from '../types.ts';

type Check = (ctx: ScanContext) => CheckResult;

const make =
  (id: string, title: string, tier: Tier) =>
  (status: Status, summary: string, extra: { details?: string[]; fix?: string } = {}): CheckResult => ({
    id,
    pillar: 'seo',
    category: 'Tags & tracking',
    title,
    tier,
    status,
    summary,
    ...(extra.details?.length ? { details: extra.details } : {}),
    ...(status !== 'pass' && status !== 'info' && extra.fix ? { fix: extra.fix } : {}),
  });

const where = (t: TagFinding) =>
  t.sources.length === 2 ? 'page + GTM' : t.sources[0] === 'gtm' ? 'via GTM' : 'in page';
const describe = (t: TagFinding) => `${t.name}${t.ids.length ? ` ${t.ids.join(', ')}` : ''} (${where(t)})`;
const KB = 1024;

// The inventory is informational: what a site runs is not good or bad in itself.
// The checks after it only speak up when there is a concrete problem, and otherwise
// stay informational too, so a page is never scored up or down just for having tags.

const inventory: Check = (ctx) => {
  const r = make('tags', 'Tags detected', 'minor');
  if (ctx.tags.length === 0) return r('info', 'No known tags in the HTML');
  const categories = [...new Set(ctx.tags.map((t) => t.category))];
  const details = categories.map(
    (cat) => `${cat}: ${ctx.tags.filter((t) => t.category === cat).map(describe).join('; ')}`,
  );
  for (const [id, res] of Object.entries(ctx.gtmContainers)) {
    if (res.status !== 200) details.push(`${id}: container not readable (${res.status || res.error})`);
    else {
      const custom = customHtmlTagCount(res.body);
      details.push(`${id}: ${Math.round(res.bytes / KB)} KB container${custom ? `, ${custom} Custom HTML tag${custom === 1 ? '' : 's'}` : ''}`);
    }
  }
  details.push('Tags bundled into first-party scripts or fired server-side are not visible to this scan.');
  const names = ctx.tags.filter((t) => t.category !== 'Verification').map((t) => t.name);
  return r('info', names.length ? `${names.length} found: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}` : 'Verification tags only', { details });
};

const legacyUa: Check = (ctx) => {
  const r = make('tags-legacy-ua', 'No retired Universal Analytics', 'minor');
  const ua = ctx.tags.find((t) => t.name.startsWith('Universal Analytics'));
  if (!ua) return r('info', 'None found');
  return r('warn', `Universal Analytics still installed: ${ua.ids.join(', ')}`, {
    details: [`Found ${where(ua)}. Universal Analytics stopped processing data in July 2024.`],
    fix: 'Remove the old UA- tags; they load code and send hits that no longer go anywhere.',
  });
};

const duplicateGa4: Check = (ctx) => {
  const r = make('tags-duplicate-ga4', 'GA4 installed once', 'minor');
  const ga4 = ctx.tags.find((t) => t.name === 'Google Analytics 4');
  if (!ga4) return r('info', 'No GA4 found');
  if (ga4.sources.length === 2) {
    return r('warn', 'GA4 is hard-coded in the page and also configured in GTM', {
      details: [`IDs: ${ga4.ids.join(', ')}`, 'If both fire for the same property, sessions and events are counted twice.'],
      fix: 'Keep GA4 in one place (usually GTM) and remove the other install.',
    });
  }
  return r('info', `${ga4.ids.join(', ')} (${where(ga4)})`);
};

const consent: Check = (ctx) => {
  const r = make('tags-consent', 'Consent management', 'minor');
  const tracking = ctx.tags.filter(
    (t) => (t.category === 'Advertising' || t.category === 'Analytics') && !['Plausible', 'Fathom'].includes(t.name),
  );
  const cmp = ctx.tags.filter((t) => t.category === 'Consent');
  if (cmp.length) return r('info', cmp.map(describe).join('; '));
  if (tracking.length === 0) return r('info', 'No tracking tags that need consent');
  return r('warn', `${tracking.length} tracking tag${tracking.length === 1 ? '' : 's'} but no consent manager detected`, {
    details: [
      `Tracking: ${tracking.map((t) => t.name).join(', ')}`,
      'A consent tool loaded from a source this scan cannot see would not show up here, so confirm before acting.',
    ],
    fix: 'If you have EU/UK or California visitors, add a consent manager (and Google Consent Mode) so tags respect consent.',
  });
};

const tagWeight: Check = (ctx) => {
  const r = make('tags-weight', 'Tag load', 'minor');
  const vendors = ctx.tags.filter((t) => ['Analytics', 'Advertising', 'Marketing'].includes(t.category));
  const heavy = Object.entries(ctx.gtmContainers).filter(([, res]) => res.status === 200 && res.bytes > 500 * KB);
  const problems = [
    ...(vendors.length >= 8 ? [`${vendors.length} analytics, ad and marketing vendors`] : []),
    ...heavy.map(([id, res]) => `${id} container is ${Math.round(res.bytes / KB)} KB`),
  ];
  if (problems.length === 0) {
    return r('info', `${vendors.length} tracking vendor${vendors.length === 1 ? '' : 's'}`);
  }
  return r('warn', problems.join('; '), {
    fix: 'Audit tags: remove unused vendors and paused tags, and move what you can server-side. Every tag costs load time.',
  });
};

export const tagChecks: Check[] = [inventory, legacyUa, duplicateGa4, consent, tagWeight];
