/**
 * Keyless live quotes via Yahoo Finance, used to annotate alert emails with a
 * price, day-change, and the instrument's real name — so a chip reads
 * "XOP · SPDR S&P Oil & Gas · $159.46 −1.56%" rather than a bare symbol.
 *
 * Same contract as resolve-url.mjs: never throws, never blocks a notification.
 * A failed lookup yields null and the template falls back to the bare ticker.
 * Only runs for alerts that already cleared their threshold.
 */

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 200;

const cache = new Map();

/** Yahoo has no ticker for a bare sector word; skip obvious non-symbols. */
function isPlausibleTicker(t) {
  return /^[A-Z][A-Z.\-]{0,5}$/.test(t);
}

async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=5m`;
  const resp = await fetch(url, { headers: UA, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!resp.ok) return null;

  const meta = (await resp.json())?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return null;

  const price = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const changePct = prev ? ((price - prev) / prev) * 100 : 0;

  return {
    ticker,
    name: meta.shortName ?? meta.longName ?? '',
    price,
    changePct,
    currency: meta.currency ?? 'USD',
  };
}

/** Returns a quote object or null. Never throws. */
export async function getQuote(ticker) {
  const key = String(ticker ?? '').toUpperCase();
  if (!key || !isPlausibleTicker(key)) return null;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.q;

  let q = null;
  try {
    q = await fetchQuote(key);
  } catch {
    q = null;   // timeout, network, malformed payload — fall back to bare chip
  }

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, { t: Date.now(), q });
  return q;
}

/**
 * Resolve several tickers concurrently. Always returns one entry per input
 * ticker, in order; entries are null when the lookup failed.
 */
export async function getQuotes(tickers = []) {
  const unique = [...new Set(tickers.filter(Boolean).map(t => String(t).toUpperCase()))];
  return Promise.all(unique.map(async t => (await getQuote(t)) ?? { ticker: t, name: '', price: null, changePct: null }));
}
