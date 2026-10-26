export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

/** Published user-agent strings, used to see whether a site treats AI agents differently from browsers. */
export const AI_AGENT_UAS: Record<string, string> = {
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  'Claude-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
};

export interface Hop {
  url: string;
  status: number;
}

export interface FetchResult {
  requestedUrl: string;
  url: string;
  status: number;
  headers: Headers;
  body: string;
  bytes: number;
  hops: Hop[];
  ms: number;
  error?: string;
}

export interface FetchOptions {
  ua?: string;
  accept?: string;
  method?: 'GET' | 'HEAD';
  timeout?: number;
  readBody?: boolean;
}

const MAX_REDIRECTS = 10;

/**
 * Fetch a URL, following redirects by hand so every hop is recorded.
 * Never throws: network failures come back as status 0 with `error` set.
 */
export async function fetchUrl(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const {
    ua = BROWSER_UA,
    accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    method = 'GET',
    timeout = 15_000,
    readBody = true,
  } = opts;
  const hops: Hop[] = [];
  const start = performance.now();
  let current = url;

  const fail = (error: string): FetchResult => ({
    requestedUrl: url,
    url: current,
    status: 0,
    headers: new Headers(),
    body: '',
    bytes: 0,
    hops,
    ms: Math.round(performance.now() - start),
    error,
  });

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    let res: Response;
    try {
      res = await fetch(current, {
        method,
        redirect: 'manual',
        headers: { 'user-agent': ua, accept, 'accept-language': 'en-US,en;q=0.9' },
        signal: AbortSignal.timeout(timeout),
      });
    } catch (err) {
      const cause = (err as { cause?: { code?: string } }).cause?.code;
      return fail(cause ?? (err as Error).name ?? 'network error');
    }

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      hops.push({ url: current, status: res.status });
      await res.body?.cancel();
      current = new URL(location, current).href;
      continue;
    }

    let body = '';
    let bytes = 0;
    if (readBody && method === 'GET') {
      const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
      bytes = buf.byteLength;
      body = new TextDecoder().decode(buf);
    } else {
      await res.body?.cancel();
      bytes = Number(res.headers.get('content-length') ?? 0);
    }

    return {
      requestedUrl: url,
      url: current,
      status: res.status,
      headers: res.headers,
      body,
      bytes,
      hops,
      ms: Math.round(performance.now() - start),
    };
  }
  return fail('too many redirects');
}

/** Run `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}
