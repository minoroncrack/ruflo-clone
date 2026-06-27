/**
 * Truth Social poller.
 *
 * Uses the Scrape Creators MCP tool (mcp__Scrape_Creators__v1_truthsocial_user_posts)
 * when running inside a Ruflo agent context, or falls back to the public
 * RSS feed at truthsocial.com/@realDonaldTrump.rss when running as a
 * standalone daemon script.
 *
 * The standalone path is used by scan-loop.mjs and requires no API key —
 * Truth Social exposes a public RSS feed per profile.
 */

import { scanPost, type ScanResult } from './keywords.js';
import { hasSeenPost, markPostSeen } from './state.js';

const TRUMP_RSS = 'https://truthsocial.com/@realDonaldTrump.rss';
const TRUMP_USERNAME = 'realDonaldTrump';

interface RssItem {
  id: string;
  text: string;
  publishedAt: string;
}

// Parse Truth Social RSS — simple XML extract, no lib needed
function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemBlocks = xml.match(/<item>(.*?)<\/item>/gs) ?? [];

  for (const block of itemBlocks) {
    const guid = block.match(/<guid[^>]*>(.*?)<\/guid>/s)?.[1]?.trim() ?? '';
    const rawTitle = block.match(/<title>(.*?)<\/title>/s)?.[1]?.trim() ?? '';
    const rawDesc = block.match(/<description>(.*?)<\/description>/s)?.[1]?.trim() ?? '';
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1]?.trim() ?? '';

    // Strip CDATA wrappers and HTML tags
    const clean = (s: string) =>
      s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
       .replace(/<[^>]+>/g, '')
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
       .trim();

    const text = clean(rawDesc) || clean(rawTitle);
    if (!guid || !text) continue;

    items.push({
      id: guid,
      text,
      publishedAt: new Date(pubDate).toISOString(),
    });
  }

  return items;
}

export async function pollTruthSocial(): Promise<ScanResult[]> {
  let xml: string;

  try {
    const resp = await fetch(TRUMP_RSS, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrumpTradeScanner/1.0)' },
    });
    if (!resp.ok) throw new Error(`RSS fetch failed: ${resp.status}`);
    xml = await resp.text();
  } catch (err) {
    console.error('Truth Social RSS fetch error:', err);
    return [];
  }

  const items = parseRss(xml);
  const newResults: ScanResult[] = [];

  for (const item of items) {
    if (hasSeenPost(item.id)) continue;
    markPostSeen(item.id);

    const result = scanPost(item.id, item.text, item.publishedAt);
    newResults.push(result);
  }

  return newResults;
}

export { TRUMP_USERNAME };
