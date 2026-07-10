/**
 * Google News link unwrapper.
 *
 * Google News RSS <link> values are opaque:
 *   https://news.google.com/rss/articles/CBMiowJBVV95cUxPMlVVNnp0...
 * The slug is protobuf-wrapped around an opaque AU_yqL... token, so it does
 * NOT base64-decode to the article URL. Resolving it "properly" means
 * replaying Google's internal /_/DotsSplashUi/data/batchexecute RPC with the
 * page's data-n-a-sg signature + data-n-a-ts timestamp; that endpoint now
 * rejects the documented payload shapes (returns [3]) and is a moving target.
 *
 * Instead we resolve by headline: query Bing News RSS, whose <link> carries the
 * destination in a plain ?url= parameter, and accept a result only if its title
 * overlaps the original headline strongly enough to be the same story.
 *
 * Design constraints:
 *  - Only called for alerts that already cleared the score threshold (~7/day),
 *    never for every polled article.
 *  - Never throws and never blocks a notification: on any miss, timeout, or
 *    network error it returns null and the caller keeps the Google URL.
 *  - Guarded by token overlap so a near-miss never attaches the wrong article.
 *
 * Measured hit rate on live alert headlines: 5/7. The rest fall back.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const MIN_OVERLAP = 0.6;
const FETCH_TIMEOUT_MS = 8000;
const CACHE_MAX = 500;

const cache = new Map();

/** Drop the " - Publisher Name" suffix Google appends to every headline. */
function stripSource(title) {
  return title.replace(/\s+-\s+[^-]{2,40}$/, '').trim();
}

function tokens(s) {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3)
  );
}

/** Fraction of the headline's significant words present in the candidate title. */
function overlap(headline, candidate) {
  const A = tokens(headline);
  const B = tokens(candidate);
  if (!A.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / A.size;
}

async function bingRss(query) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS`;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) return '';
    return await resp.text();
  } catch {
    return '';
  }
}

function extractDestination(link) {
  try {
    const u = new URL(link.replace(/&amp;/g, '&'));
    const dest = u.searchParams.get('url');
    if (dest) return decodeURIComponent(dest);
    // Some Bing items link straight to the publisher.
    if (!/bing\.com/i.test(u.hostname)) return u.href;
  } catch { /* malformed URL -> treat as miss */ }
  return null;
}

/**
 * resolveArticleUrl(headline, fallbackUrl)
 * Always returns a usable URL — the resolved one, or fallbackUrl.
 */
export async function resolveArticleUrl(headline, fallbackUrl) {
  if (!headline) return fallbackUrl;

  if (cache.has(headline)) return cache.get(headline) ?? fallbackUrl;

  const base = stripSource(headline);
  const words = base.split(/\s+/);

  // Bing's RSS is erratic on long queries (a 12-word query can return zero
  // items where an 8-word one returns a hit), so try progressively shorter
  // forms rather than trusting any single query length.
  const queries = [base, words.slice(0, 8).join(' '), words.slice(0, 5).join(' ')];

  let resolved = null;

  for (const q of queries) {
    if (!q) continue;
    const xml = await bingRss(q);
    if (!xml) continue;

    for (const block of (xml.match(/<item>[\s\S]*?<\/item>/g) ?? []).slice(0, 5)) {
      const title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/&amp;/g, '&')
        .trim();
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '';
      if (!title || !link) continue;

      // The top Bing hit is frequently a *different* story on the same topic.
      // Only accept a candidate that is lexically the same headline.
      if (overlap(base, title) < MIN_OVERLAP) continue;

      const dest = extractDestination(link);
      if (dest) { resolved = dest; break; }
    }
    if (resolved) break;
  }

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(headline, resolved);

  return resolved ?? fallbackUrl;
}
