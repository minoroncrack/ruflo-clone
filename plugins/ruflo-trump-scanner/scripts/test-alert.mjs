#!/usr/bin/env node
/**
 * Sends a test alert through every configured channel so you can verify .env
 * and see exactly what a real alert looks like.
 *
 * Exercises the full enrichment path — live quotes, og:image, link resolution
 * — rather than dispatching a bare payload. A bare dispatch would render the
 * sparsest possible email and tell you nothing about how real alerts look.
 *
 * Prefers a genuine, currently-qualifying news article. Falls back to a
 * synthetic payload (still with live quotes) when nothing clears the
 * threshold, so the script always sends.
 *
 * Usage: node scripts/test-alert.mjs
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));

const { dispatch } = await import('../src/alerts.mjs');
const { parseRss, formatNewsAlert } = await import('../src/news.mjs');
const { scanPost, computeDirection } = await import('../src/keywords.mjs');
const { resolveArticleUrl, fetchOgImage } = await import('../src/resolve-url.mjs');
const { getQuotes } = await import('../src/quotes.mjs');
const { buildChartUrl } = await import('../src/chart.mjs');

const QUERY = 'trump (stock market OR economy OR tariff OR interview OR speech OR "executive order") when:1d';
const NEWS_RSS = `https://news.google.com/rss/search?q=${encodeURIComponent(QUERY)}&hl=en-US&gl=US&ceid=US:en`;

/** Highest-scoring article that currently clears the alert threshold, or null. */
async function topLiveArticle() {
  try {
    const resp = await fetch(NEWS_RSS, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrumpTradeScanner/1.0)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const items = parseRss(await resp.text());
    const scored = items
      .map(item => ({ item, scan: scanPost(item.id, item.scanText, item.publishedAt) }))
      .filter(x => x.scan.alert)
      .sort((a, b) => b.scan.totalScore - a.scan.totalScore);
    return scored[0] ?? null;
  } catch {
    return null;
  }
}

const top = await topLiveArticle();

if (top) {
  const { item, scan } = top;
  const tickers = [...new Set(scan.matches.map(m => m.extractedTicker).filter(Boolean))];
  const link = await resolveArticleUrl(item.text, item.link);
  const [ogImage, quotes] = await Promise.all([fetchOgImage(link), getQuotes(tickers)]);
  const image = ogImage ?? buildChartUrl(quotes);   // msn.com has no og:image

  console.log(`Using live article — score ${scan.totalScore}/100`);
  console.log(`  ${item.text.slice(0, 72)}`);
  console.log(`  tickers: ${tickers.join(', ') || '(none)'}`);
  console.log(`  image  : ${ogImage ? 'og:image (publisher photo)' : image ? 'sparkline chart (no og:image)' : 'none'}`);

  await dispatch(
    `📰 TRUMP NEWS SIGNAL [${scan.totalScore}/100] — ${tickers.slice(0, 3).join(', ') || 'market signal'} [TEST]`,
    formatNewsAlert({ ...scan, postText: item.text, source: item.source, link }),
    {
      emoji: '📰',
      headline: 'TRUMP NEWS SIGNAL [TEST]',
      scoreLabel: `${scan.totalScore}/100`,
      direction: computeDirection(scan.matches),
      source: item.source,
      timestamp: item.publishedAt,
      quote: item.text,
      tickers,
      quotes,
      image,
      keywords: scan.matches.map(m => m.keyword),
      link,
    }
  );
} else {
  // Nothing qualifying right now — still prove the channels and the quote path.
  const tickers = ['ITA', 'LMT', 'NOC'];
  const quotes = await getQuotes(tickers);
  const image = buildChartUrl(quotes);
  console.log('No qualifying live article — sending synthetic alert with live quotes.');

  await dispatch(
    '🚨 TRUMP TRADE SIGNAL [85/100] — ITA, LMT, NOC [TEST]',
    [
      'This is a TEST alert from the Trump Trade Scanner.',
      '',
      '"The military is going to be incredible. We are going to rebuild it like never before."',
      '',
      'If you received this, your alerts are working correctly.',
    ].join('\n'),
    {
      emoji: '🚨',
      headline: 'TRUMP TRADE SIGNAL [TEST]',
      scoreLabel: '85/100',
      direction: 'BULLISH',
      source: 'Truth Social',
      timestamp: new Date().toISOString(),
      quote: 'The military is going to be incredible. We are going to rebuild it like never before.',
      tickers,
      quotes,
      image,
      keywords: ['military', 'incredible', 'defense'],
      link: 'https://trumpstruth.org/',
    }
  );
}

console.log('Test alert sent.');
