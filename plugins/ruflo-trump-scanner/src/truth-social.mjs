/**
 * Truth Social poller via public RSS feed.
 * No API key required.
 */

import { scanPost } from './keywords.mjs';
import { hasSeenPost, markPostSeen } from './state.mjs';

const TRUMP_RSS = 'https://truthsocial.com/@realDonaldTrump.rss';

function parseRss(xml) {
  const items = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  for (const block of blocks) {
    const guid    = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() ?? '';
    const title   = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim()    ?? '';
    const desc    = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.trim() ?? '';
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? '';

    const clean = s => s
      .replace(/<\!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
      .trim();

    const text = clean(desc) || clean(title);
    if (!guid || !text) continue;
    items.push({ id: guid, text, publishedAt: new Date(pubDate).toISOString() });
  }
  return items;
}

export async function pollTruthSocial() {
  let xml;
  try {
    const resp = await fetch(TRUMP_RSS, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrumpTradeScanner/1.0; +https://github.com/minoroncrack/ruflo-clone)' },
    });
    if (!resp.ok) throw new Error(`RSS ${resp.status}`);
    xml = await resp.text();
  } catch (err) {
    console.error('Truth Social RSS error:', err.message);
    return [];
  }

  const results = [];
  for (const item of parseRss(xml)) {
    if (hasSeenPost(item.id)) continue;
    markPostSeen(item.id);
    results.push(scanPost(item.id, item.text, item.publishedAt));
  }
  return results;
}
