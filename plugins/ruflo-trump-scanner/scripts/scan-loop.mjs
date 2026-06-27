#!/usr/bin/env node
/**
 * Trump Trade Scanner — main daemon loop.
 *
 * Polls Truth Social every 90 seconds and USASpending.gov every 15 minutes.
 * Dispatches alerts via configured channels (email, webhook, ntfy).
 *
 * Usage:
 *   node scripts/scan-loop.mjs
 *
 * Required env vars (set at least one alert channel):
 *   NTFY_TOPIC           — ntfy.sh push topic (recommended, free)
 *   ALERT_WEBHOOK_URL    — Discord/Slack/Zapier webhook
 *   SMTP_HOST / SMTP_USER / SMTP_PASS / ALERT_EMAIL_TO — email
 *
 * Optional:
 *   POLL_INTERVAL_POSTS_MS     — default 90000 (90s)
 *   POLL_INTERVAL_CONTRACTS_MS — default 900000 (15m)
 */

import { pollTruthSocial } from '../src/truth-social.js';
import { fetchRecentContracts, formatContractAlert } from '../src/contracts.js';
import { scanPost, formatAlert } from '../src/keywords.js';
import { dispatch } from '../src/alerts.js';
import { hasSeenAward, markAwardSeen } from '../src/state.js';

const POST_INTERVAL   = Number(process.env.POLL_INTERVAL_POSTS_MS     ?? 90_000);   // 90s
const CONTRACT_INTERVAL = Number(process.env.POLL_INTERVAL_CONTRACTS_MS ?? 900_000); // 15m

console.log('🚨 Trump Trade Scanner starting...');
console.log(`  Truth Social poll: every ${POST_INTERVAL / 1000}s`);
console.log(`  USASpending poll:  every ${CONTRACT_INTERVAL / 1000}s`);
console.log();

// --- Truth Social loop ---
async function pollPosts() {
  try {
    console.log(`[${new Date().toISOString()}] Checking Truth Social...`);
    const results = await pollTruthSocial();

    if (results.length === 0) {
      console.log('  No new posts.');
      return;
    }

    console.log(`  ${results.length} new post(s) found.`);

    for (const result of results) {
      if (result.alert) {
        const subject = `🚨 TRUMP TRADE SIGNAL [${result.totalScore}/100] — ${result.matches.map(m => m.extractedTicker || m.keyword).slice(0, 3).join(', ')}`;
        const body = formatAlert(result);
        await dispatch(subject, body);
      } else {
        console.log(`  Post scored ${result.totalScore}/100 — below alert threshold, skipping.`);
      }
    }
  } catch (err) {
    console.error('Post poll error:', err);
  }
}

// --- USASpending contract loop ---
async function pollContracts() {
  try {
    console.log(`[${new Date().toISOString()}] Checking USASpending.gov...`);
    const awards = await fetchRecentContracts(1);

    if (awards.length === 0) {
      console.log('  No new qualifying contracts.');
      return;
    }

    console.log(`  ${awards.length} qualifying contract(s) found.`);

    for (const award of awards) {
      if (hasSeenAward(award.awardId)) continue;
      markAwardSeen(award.awardId);

      const amt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(award.awardAmount);
      const subject = `🛡️ CONTRACT WIN — ${award.recipientName} — ${amt}`;
      const body = formatContractAlert(award);
      await dispatch(subject, body);
    }
  } catch (err) {
    console.error('Contract poll error:', err);
  }
}

// Kick off immediately, then on interval
await pollPosts();
await pollContracts();

setInterval(pollPosts, POST_INTERVAL);
setInterval(pollContracts, CONTRACT_INTERVAL);

// Keep alive
process.on('SIGINT', () => {
  console.log('\nScanner stopped.');
  process.exit(0);
});
