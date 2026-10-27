import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customHtmlTagCount, detectTags, gtmContainerIds } from '../src/tags.ts';

const GTM_SNIPPET = `<script>(function(w,d,s,l,i){w[l]=w[l]||[];var f=d.getElementsByTagName(s)[0],
j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;
f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-ABC1234');</script>`;

const GTAG = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST12345"></script>
<script>gtag('js', new Date()); gtag('config', 'G-TEST12345');</script>`;

const find = (tags: ReturnType<typeof detectTags>, name: string) => tags.find((t) => t.name === name);

test('reads GTM IDs from the standard snippet, where the ID is a separate argument', () => {
  assert.deepEqual(gtmContainerIds(GTM_SNIPPET), ['GTM-ABC1234']);
});

test('ignores GTM-looking strings on pages that do not load GTM', () => {
  assert.deepEqual(gtmContainerIds('<p>Order GTM-ABC1234 shipped</p>'), []);
});

test('detects hard-coded GA4 with its measurement ID', () => {
  const ga4 = find(detectTags(GTAG), 'Google Analytics 4');
  assert.deepEqual(ga4, { name: 'Google Analytics 4', category: 'Analytics', ids: ['G-TEST12345'], sources: ['page'] });
});

test('marks a tag found in both the page and a GTM container', () => {
  const container = '{"function":"__googtag","vtp_tagId":"G-TEST12345"}';
  const ga4 = find(detectTags(GTAG, { 'GTM-ABC1234': container }), 'Google Analytics 4');
  assert.deepEqual(ga4?.sources, ['page', 'gtm']);
});

test('finds tags that only live inside a GTM container', () => {
  const container = '"vtp_conversionId":"AW-836961410" "https://bat.bing.com/bat.js" "https://snap.licdn.com/li.lms-analytics/insight.min.js"';
  const tags = detectTags(GTM_SNIPPET, { 'GTM-ABC1234': container });
  assert.deepEqual(find(tags, 'Google Ads')?.ids, ['AW-836961410']);
  assert.deepEqual(find(tags, 'Microsoft Ads (UET)')?.sources, ['gtm']);
  assert.ok(find(tags, 'LinkedIn Insight'));
});

test('a container mentioning its own ID does not count as GTM inside GTM', () => {
  const tags = detectTags(GTM_SNIPPET, { 'GTM-ABC1234': '"containerId":"GTM-ABC1234"' });
  assert.deepEqual(find(tags, 'Google Tag Manager')?.sources, ['page']);
});

test('detects retired Universal Analytics IDs', () => {
  const tags = detectTags(`<script>ga('create', 'UA-1234567-1', 'auto');</script>`);
  assert.deepEqual(find(tags, 'Universal Analytics (retired)')?.ids, ['UA-1234567-1']);
});

test('verification meta tags are found in the page', () => {
  const tags = detectTags('<meta name="google-site-verification" content="abc"><meta name="msvalidate.01" content="x">');
  assert.deepEqual(tags.map((t) => t.name), ['Google Search Console', 'Bing Webmaster Tools']);
});

test('detects consent managers and Google Consent Mode', () => {
  const tags = detectTags(`<script src="https://cdn.cookielaw.org/scripttemplates/otSDKStub.js"></script>
    <script>gtag('consent', 'default', {ad_storage: 'denied'});</script>`);
  assert.ok(find(tags, 'OneTrust'));
  assert.ok(find(tags, 'Google Consent Mode'));
});

test('results are grouped by category', () => {
  const tags = detectTags(`${GTAG}<meta name="google-site-verification" content="a">${GTM_SNIPPET}`);
  assert.deepEqual(tags.map((t) => t.category), ['Tag manager', 'Analytics', 'Verification']);
});

test('counts Custom HTML tags in a container', () => {
  assert.equal(customHtmlTagCount('{"function":"__html","x":1},{"function":"__html"},{"function":"__gaawc"}'), 2);
});

test('recognises hand-built consent code when no named tool is present', () => {
  const tags = detectTags(`<script>if (window.siteConsent && window.siteConsent.hasOptedOut()) {}</script>`);
  assert.deepEqual(tags.map((t) => t.name), ['Custom consent code']);
});

test('recognises consent gates that read a consent cookie before loading a tag', () => {
  const tags = detectTags(`<script>(function(){
var m=document.cookie.match(new RegExp("(?:^|;\\\\s*)site\\\\.consent\\\\.v1=([^;]*)"));
if(m&&m[1].indexOf("analytics")<0)return;
})();</script><script src="https://www.clarity.ms/tag/abc"></script>`);
  assert.deepEqual(tags.map((t) => t.name), ['Microsoft Clarity', 'Custom consent code']);
});

test('marketing copy about consent is not treated as consent code', () => {
  const tags = detectTags('<p>Integrations with consent management solutions</p>');
  assert.deepEqual(tags, []);
});
