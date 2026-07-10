#!/usr/bin/env node
/**
 * Trump Trade Scanner — main daemon.
 * Polls Truth Social every 90s, USASpending every 15m.
 *
 * Usage:
 *   node scripts/scan-loop.mjs
 *
 * Set at least one alert channel in .env:
 *   NTFY_TOPIC, ALERT_WEBHOOK_URL, or SMTP_* + ALERT_EMAIL_TO
 */

import { pollTruthSocial }                       from '../src/truth-social.mjs';
import { fetchRecentContracts, formatContractAlert } from '../src/contracts.mjs';
import { pollNews, formatNewsAlert }              from '../src/news.mjs';
import { formatAlert, computeDirection }          from '../src/keywords.mjs';
import { dispatch }                               from '../src/alerts.mjs';
import { resolveArticleUrl }                     from '../src/resolve-url.mjs';
import { pollApproval, formatPollAlert }         from '../src/polls.mjs';
import { hasSeenAward, markAwardSeen }            from '../src/state.mjs';
import { writeFileSync, mkdirSync, existsSync }   from 'fs';
import { join, dirname }                          from 'path';
import { fileURLToPath }                          from 'url';

process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));

const HEART = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'heartbeat.json');
function beat(source) {
  try { const d = dirname(HEART); if (!existsSync(d)) mkdirSync(d, { recursive: true });
    writeFileSync(HEART, JSON.stringify({ ts: Date.now(), source })); } catch {}
}

const POST_INTERVAL     = Number(process.env.POLL_INTERVAL_POSTS_MS     ?? 90_000);
const CONTRACT_INTERVAL = Number(process.env.POLL_INTERVAL_CONTRACTS_MS ?? 900_000);
const NEWS_INTERVAL     = Number(process.env.POLL_INTERVAL_NEWS_MS      ?? 300_000);
// Approval polls publish ~1/day and arrive in bursts; hourly is ample.
const POLLS_INTERVAL    = Number(process.env.POLL_INTERVAL_POLLS_MS     ?? 3_600_000);

console.log('🚨 Trump Trade Scanner starting...');
console.log(`  Truth Social : every ${POST_INTERVAL / 1000}s`);
console.log(`  USASpending  : every ${CONTRACT_INTERVAL / 1000}s`);
console.log(`  News/Speeches: every ${NEWS_INTERVAL / 1000}s`);

async function pollPosts() {
  try {
    console.log(`[${new Date().toISOString()}] Checking Truth Social...`);
    beat('truth-social');
    const results = await pollTruthSocial();
    if (!results.length) { console.log('  No new posts.'); return; }
    console.log(`  ${results.length} new post(s).`);
    for (const r of results) {
      if (!r.alert) { console.log(`  Score ${r.totalScore}/100 — below threshold, skipping.`); continue; }
      const tickers = [...new Set(r.matches.map(m => m.extractedTicker).filter(Boolean))];
      await dispatch(
        `🚨 TRUMP TRADE SIGNAL [${r.totalScore}/100] — ${tickers.slice(0, 3).join(', ') || 'market signal'}`,
        formatAlert(r),
        {
          emoji: '🚨',
          headline: 'TRUMP TRADE SIGNAL',
          scoreLabel: `${r.totalScore}/100`,
          direction: computeDirection(r.matches),
          source: 'Truth Social',
          timestamp: r.postedAt,
          quote: r.postText,
          tickers,
          keywords: r.matches.map(m => m.keyword),
          link: r.originalUrl,
        }
      );
    }
  } catch (e) { console.error('Post poll error:', e.message); }
}

async function pollNewsArticles() {
  try {
    console.log(`[${new Date().toISOString()}] Checking news/speeches...`);
    beat('news');
    const results = await pollNews();
    if (!results.length) { console.log('  No new articles.'); return; }
    console.log(`  ${results.length} new article(s).`);
    for (const r of results) {
      if (!r.alert) { console.log(`  Score ${r.totalScore}/100 — below threshold, skipping.`); continue; }
      const tickers = [...new Set(r.matches.map(m => m.extractedTicker).filter(Boolean))];

      // Only alerts get their link unwrapped (~7/day), never every polled item.
      // Returns the original Google URL on any miss/timeout, so this can slow a
      // notification slightly but can never prevent or misdirect one.
      const resolved = await resolveArticleUrl(r.postText, r.link);
      if (resolved !== r.link) console.log(`  Resolved link -> ${resolved.slice(0, 70)}`);
      r.link = resolved;

      await dispatch(
        `📰 TRUMP NEWS SIGNAL [${r.totalScore}/100] — ${tickers.slice(0, 3).join(', ') || 'market signal'}`,
        formatNewsAlert(r),
        {
          emoji: '📰',
          headline: 'TRUMP NEWS SIGNAL',
          scoreLabel: `${r.totalScore}/100`,
          direction: computeDirection(r.matches),
          source: r.source,
          timestamp: r.postedAt,
          quote: r.postText,
          tickers,
          keywords: r.matches.map(m => m.keyword),
          link: r.link,
        }
      );
    }
  } catch (e) { console.error('News poll error:', e.message); }
}

async function pollContracts() {
  try {
    console.log(`[${new Date().toISOString()}] Checking USASpending.gov...`);
    // 7d, not 1d: USASpending lags and a 24h window always returns zero.
    // seenAwardIds dedupes, so a wider window re-alerts nothing.
    const awards = await fetchRecentContracts(7);
    if (!awards.length) { console.log('  No qualifying contracts.'); return; }
    console.log(`  ${awards.length} contract(s) found.`);
    for (const award of awards) {
      if (hasSeenAward(award.awardId)) continue;
      markAwardSeen(award.awardId);
      const amt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(award.awardAmount);
      const emoji = award.category === 'defense' ? '🛡️' : award.category === 'medical' ? '💊' : '💻';
      await dispatch(
        `${emoji} CONTRACT WIN — ${award.recipientName} — ${amt}`,
        formatContractAlert(award),
        {
          emoji,
          headline: 'CONTRACT WIN',
          scoreLabel: amt,
          source: award.agencyName,
          timestamp: award.awardDate,
          quote: award.description || `${award.recipientName} — ${award.naicsDescription}`,
          tickers: [award.category.toUpperCase(), award.naicsCode],
          keywords: [award.recipientState, award.naicsDescription].filter(Boolean),
        }
      );
    }
  } catch (e) { console.error('Contract poll error:', e.message); }
}

async function pollApprovalPolls() {
  try {
    console.log(`[${new Date().toISOString()}] Checking approval polls...`);
    beat('polls');
    const results = await pollApproval();
    if (!results.length) { console.log('  No qualifying poll movement.'); return; }
    console.log(`  ${results.length} poll(s) with significant movement.`);
    for (const r of results) {
      const arrow = r.delta > 0 ? '📈' : '📉';
      await dispatch(
        `${arrow} TRUMP APPROVAL ${r.direction} — ${r.delta > 0 ? '+' : ''}${r.delta} pts (${r.pollster})`,
        formatPollAlert(r),
        {
          emoji: arrow,
          headline: 'APPROVAL SHIFT',
          scoreLabel: `${r.delta > 0 ? '+' : ''}${r.delta} pts`,
          direction: r.direction,
          source: r.pollster,
          timestamp: r.endDate,
          quote: `Net approval ${r.net > 0 ? '+' : ''}${r.net}, was ${r.baseline > 0 ? '+' : ''}${r.baseline}`,
          tickers: [],
          keywords: [r.pollster, r.population].filter(Boolean),
          link: r.url,
          tags: ['bar_chart'],
        }
      );
    }
  } catch (e) { console.error('Poll check error:', e.message); }
}

// Run immediately then on interval
await pollPosts();
await pollContracts();
await pollNewsArticles();
await pollApprovalPolls();
setInterval(pollPosts, POST_INTERVAL);
setInterval(pollContracts, CONTRACT_INTERVAL);
setInterval(pollNewsArticles, NEWS_INTERVAL);
setInterval(pollApprovalPolls, POLLS_INTERVAL);

process.on('SIGINT', () => { console.log('\nScanner stopped.'); process.exit(0); });
