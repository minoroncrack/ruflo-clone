/**
 * Feed recorder — appends every dispatched alert to data/feed.json
 * so the dashboard can render real scanner history. Local-only, no secrets.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR  = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FILE = join(DIR, 'feed.json');
const MAX  = 500;

/** Parse score, tickers (signals) or recipient/amount (contracts) from subject. */
function parseSubject(subject) {
  const score = Number((subject.match(/\[(\d{1,3})\/100\]/) || [])[1] ?? 0);

  if (/CONTRACT/i.test(subject)) {
    // "🛡️ CONTRACT WIN — Lockheed Martin — $1,200,000,000"
    const parts = subject.split('—').map(s => s.trim());
    return {
      score, kind: 'contract', tickers: [],
      recipient: parts[1] || '',
      amount: parts[2] || '',
    };
  }

  // Signal: tickers are the comma list after the final em-dash.
  const dash = subject.lastIndexOf('—');
  const tickers = dash >= 0
    ? subject.slice(dash + 1).split(',').map(s => s.trim()).filter(Boolean)
    : [];
  return { score, kind: 'signal', tickers };
}

function load() {
  try { return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf-8')) : []; }
  catch { return []; }
}

export function recordFeed(subject, body, opts = {}) {
  try {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
    const parsed = parseSubject(subject);
    const entry = {
      ts: Date.now(),
      subject, body,
      ...parsed,
      tickers: (opts.tickers && opts.tickers.length) ? opts.tickers : parsed.tickers,
      source: opts.source ?? null,
      link: opts.link ?? null,
      direction: opts.direction ?? null,
      keywords: opts.keywords ?? [],
    };
    const next = [entry, ...load()].slice(0, MAX);
    writeFileSync(FILE, JSON.stringify(next, null, 2));
  } catch (e) {
    console.error('feed write failed:', e.message);
  }
}
