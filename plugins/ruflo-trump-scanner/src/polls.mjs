/**
 * Trump approval polling via VoteHub's free API.
 *
 * Source choice: FiveThirtyEight's president_approval_polls.csv — the endpoint
 * every scraper used — is gone. ABC shut the operation down and the URL now
 * 302s to abcnews.com/politics. RealClearPolling returns 403 to non-browsers.
 * VoteHub (api.votehub.com) is the surviving free, unauthenticated source.
 *
 * Alerting: approval polls carry no market keywords, so scanPost() would score
 * every one of them 0. A poll alerts when its net approval (Approve -
 * Disapprove) moves at least NET_DELTA_THRESHOLD points against *that same
 * pollster's* previous poll.
 *
 * Why same-pollster, not a trailing average of all pollsters: house effects
 * dominate. Backtested over 1,015 real polls (2025-01 -> 2026-06):
 *
 *   poll vs trailing avg of last 7 polls, >=3pts  -> 8.7 alerts/week
 *   poll vs trailing avg of last 7 polls, >=5pts  -> 6.0 alerts/week
 *   same pollster vs its own last poll,   >=5pts  -> 3.3 alerts/week
 *
 * The trailing-average version fires constantly on pollster identity rather
 * than on movement — e.g. McLaughlin (R-leaning) printed net -4 against a
 * -18.9 baseline, a 14.9pt "swing" that was purely a house effect. Comparing a
 * pollster to itself cancels that bias. A pollster with no prior poll is
 * skipped: there is nothing to measure movement against.
 *
 * Bootstrapping: the API returns ~1,400 historical polls. On a cold start
 * every one is unseen, so the first run marks history as seen and alerts on
 * nothing. Without this the first poll cycle would dispatch hundreds of
 * notifications.
 */

import { hasSeenPoll, markPollSeen, markPollsSeen, pollSeenCount } from './state.mjs';

const API = 'https://api.votehub.com/polls?type=approval';
const UA = 'Mozilla/5.0 (compatible; TrumpTradeScanner/1.0)';
const FETCH_TIMEOUT_MS = 20_000;

const NET_DELTA_THRESHOLD = 5;   // points of movement vs same pollster's last

/** Net approval: Approve% - Disapprove%. Null when either answer is absent. */
export function netApproval(poll) {
  const answers = Object.fromEntries(
    (poll.answers ?? []).map(a => [String(a.choice).toLowerCase(), Number(a.pct)])
  );
  const app = answers['approve'];
  const dis = answers['disapprove'];
  if (!Number.isFinite(app) || !Number.isFinite(dis)) return null;
  // VoteHub reports fractional pcts (44.4, 53.3); avoid float dust like -8.899999.
  return Number((app - dis).toFixed(1));
}

function isTrumpApproval(poll) {
  return poll.poll_type === 'approval' && /trump/i.test(poll.subject ?? '');
}

/**
 * Returns Trump approval polls sorted oldest -> newest, each with `net`.
 * Polls missing an end_date or a usable net are dropped.
 */
export function normalize(rows) {
  return rows
    .filter(isTrumpApproval)
    .map(p => ({ ...p, net: netApproval(p) }))
    .filter(p => p.end_date && p.net !== null)
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
}

async function fetchPolls() {
  const resp = await fetch(API, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`VoteHub ${resp.status}`);
  const rows = await resp.json();
  if (!Array.isArray(rows)) throw new Error('VoteHub: unexpected payload');
  return rows;
}

/**
 * pollApproval()
 * Returns [] on a cold start (after seeding history) and on any error.
 * Otherwise returns alert-worthy polls, each carrying baseline + delta.
 */
export async function pollApproval() {
  let rows;
  try {
    rows = await fetchPolls();
  } catch (err) {
    console.error('Polls API error:', err.message);
    return [];
  }

  const polls = normalize(rows);
  if (!polls.length) return [];

  // Cold start: seed history, alert on nothing.
  if (pollSeenCount() === 0) {
    markPollsSeen(polls.map(p => p.id));
    console.log(`  Bootstrapped ${polls.length} historical polls — no alerts on first run.`);
    return [];
  }

  const results = [];

  // Each pollster's most recent net, walking history oldest -> newest. Built
  // from the full feed (not just unseen rows) so a new poll always compares
  // against that pollster's true previous reading.
  const lastByPollster = new Map();

  for (const poll of polls) {
    const pollster = poll.pollster ?? 'unknown';
    const previous = lastByPollster.get(pollster);
    lastByPollster.set(pollster, poll.net);

    if (hasSeenPoll(poll.id)) continue;
    markPollSeen(poll.id);

    if (previous === undefined) continue;   // first poll from this pollster

    const delta = Number((poll.net - previous).toFixed(1));
    if (Math.abs(delta) < NET_DELTA_THRESHOLD) continue;

    results.push({
      id: poll.id,
      pollster,
      sampleSize: poll.sample_size ?? null,
      population: poll.population ?? '',
      endDate: poll.end_date,
      net: poll.net,
      baseline: previous,
      delta,
      direction: delta > 0 ? 'IMPROVING' : 'DECLINING',
      url: poll.url ?? '',
    });
  }

  return results;
}

export function formatPollAlert(r) {
  const arrow = r.delta > 0 ? '📈' : '📉';
  const sign = r.delta > 0 ? '+' : '';
  return [
    `${arrow} TRUMP APPROVAL ${r.direction} — net ${r.net > 0 ? '+' : ''}${r.net}`,
    `Pollster : ${r.pollster}`,
    `Field end: ${r.endDate}`,
    `Sample   : ${r.sampleSize ?? '?'} ${r.population || ''}`.trim(),
    ``,
    `Net approval : ${r.net > 0 ? '+' : ''}${r.net}`,
    `Their last   : ${r.baseline > 0 ? '+' : ''}${r.baseline}  (same pollster)`,
    `Movement     : ${sign}${r.delta} pts`,
    ``,
    r.url,
  ].join('\n');
}
