/**
 * Public news poller via Google News RSS.
 * Catches articles, interview quotes, and speech coverage from mainstream
 * outlets — no API key required, no login, publicly published content only.
 */

import { scanPost } from './keywords.mjs';
import { hasSeenNews, markNewsSeen } from './state.mjs';

const QUERY = 'trump (stock market OR economy OR tariff OR interview OR speech OR "executive order") when:1d';
const NEWS_RSS = `https://news.google.com/rss/search?q=${encodeURIComponent(QUERY)}&hl=en-US&gl=US&ceid=US:en`;

export function parseRss(xml) {
  const items = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  for (const block of blocks) {
    const guid    = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() ?? '';
    const title   = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim()    ?? '';
    const desc    = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.trim() ?? '';
    const link    = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim()     ?? '';
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? '';
    const source  = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() ?? '';

    // Order matters. Google News ships <description> HTML-escaped ("&lt;a
    // href=..."), so stripping tags before decoding entities removes nothing
    // and leaves the raw news.google.com URL in the text -- which made the
    // company rule match 'google' (GOOGL, 55pts) on literally every article.
    // Decode entities first, then strip real tags, then drop leftover URLs
    // (their base64 slugs can also trip the $TICKER regex).
    const clean = s => s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/<[^>]+>/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    const text = clean(title);
    if (!guid || !text) continue;
    // `text` stays the headline (what alerts display). `scanText` adds the
    // description so scoring sees a paragraph rather than ~10 words of title.
    const scanText = [text, clean(desc)].filter(Boolean).join('. ');
    items.push({ id: guid, text, scanText, link, source: clean(source), publishedAt: new Date(pubDate).toISOString() });
  }
  return items;
}

export async function pollNews() {
  let xml;
  try {
    // No default timeout in Node's fetch — bound it or a stalled connection
    // wedges the news poller permanently.
    const resp = await fetch(NEWS_RSS, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrumpTradeScanner/1.0; +https://github.com/minoroncrack/ruflo-clone)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`News RSS ${resp.status}`);
    xml = await resp.text();
  } catch (err) {
    console.error('News RSS error:', err.message);
    return [];
  }

  const results = [];
  for (const item of parseRss(xml)) {
    if (hasSeenNews(item.id)) continue;
    markNewsSeen(item.id);
    const scored = scanPost(item.id, item.scanText, item.publishedAt);
    // Score over title+description, but alerts quote the headline only.
    results.push({ ...scored, postText: item.text, source: item.source, link: item.link });
  }
  return results;
}

export function formatNewsAlert(result) {
  const tickers = [...new Set(result.matches.map(m => m.extractedTicker).filter(Boolean))];
  const bullishCount = result.matches.filter(m => m.direction === 'bullish').length;
  const bearishCount = result.matches.filter(m => m.direction === 'bearish').length;
  const dir = bullishCount >= bearishCount ? '📈 BULLISH' : '📉 BEARISH';

  return [
    `📰 TRUMP NEWS SIGNAL [Score: ${result.totalScore}/100] ${dir}`,
    `Source: ${result.source || 'unknown'}`,
    `Published: ${result.postedAt}`,
    ``,
    `"${result.postText}"`,
    ``,
    `Tickers/ETFs: ${tickers.join(', ') || 'see keywords'}`,
    `Keywords: ${result.matches.map(m => m.keyword).join(', ')}`,
    ``,
    result.link,
  ].join('\n');
}
