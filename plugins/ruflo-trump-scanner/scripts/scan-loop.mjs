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
import { formatAlert }                            from '../src/keywords.mjs';
import { dispatch }                               from '../src/alerts.mjs';
import { hasSeenAward, markAwardSeen }            from '../src/state.mjs';

const POST_INTERVAL     = Number(process.env.POLL_INTERVAL_POSTS_MS     ?? 90_000);
const CONTRACT_INTERVAL = Number(process.env.POLL_INTERVAL_CONTRACTS_MS ?? 900_000);

console.log('🚨 Trump Trade Scanner starting...');
console.log(`  Truth Social : every ${POST_INTERVAL / 1000}s`);
console.log(`  USASpending  : every ${CONTRACT_INTERVAL / 1000}s`);

async function pollPosts() {
  try {
    console.log(`[${new Date().toISOString()}] Checking Truth Social...`);
    const results = await pollTruthSocial();
    if (!results.length) { console.log('  No new posts.'); return; }
    console.log(`  ${results.length} new post(s).`);
    for (const r of results) {
      if (!r.alert) { console.log(`  Score ${r.totalScore}/100 — below threshold, skipping.`); continue; }
      const tickers = [...new Set(r.matches.map(m => m.extractedTicker).filter(Boolean))].slice(0, 3).join(', ');
      await dispatch(`🚨 TRUMP TRADE SIGNAL [${r.totalScore}/100] — ${tickers || 'market signal'}`, formatAlert(r));
    }
  } catch (e) { console.error('Post poll error:', e.message); }
}

async function pollContracts() {
  try {
    console.log(`[${new Date().toISOString()}] Checking USASpending.gov...`);
    const awards = await fetchRecentContracts(1);
    if (!awards.length) { console.log('  No qualifying contracts.'); return; }
    console.log(`  ${awards.length} contract(s) found.`);
    for (const award of awards) {
      if (hasSeenAward(award.awardId)) continue;
      markAwardSeen(award.awardId);
      const amt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(award.awardAmount);
      await dispatch(`🛡️ CONTRACT WIN — ${award.recipientName} — ${amt}`, formatContractAlert(award));
    }
  } catch (e) { console.error('Contract poll error:', e.message); }
}

// Run immediately then on interval
await pollPosts();
await pollContracts();
setInterval(pollPosts, POST_INTERVAL);
setInterval(pollContracts, CONTRACT_INTERVAL);

process.on('SIGINT', () => { console.log('\nScanner stopped.'); process.exit(0); });
