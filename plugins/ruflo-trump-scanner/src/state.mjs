/**
 * Persistent seen-IDs state so the scanner never double-alerts after restart.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR   = join(dirname(fileURLToPath(import.meta.url)), '..', '.state');
const FILE  = join(DIR, 'seen.json');
const EMPTY = { seenPostIds: [], seenAwardIds: [], seenNewsIds: [], seenPollIds: [] };

function load() {
  try { return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf-8')) : { ...EMPTY }; }
  catch { return { ...EMPTY }; }
}

function save(s) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(s, null, 2));
}

export function hasSeenPost(id)   { return (load().seenPostIds ?? []).includes(id); }
export function markPostSeen(id)  { const s = load(); s.seenPostIds  = [id, ...(s.seenPostIds  ?? [])].slice(0, 5000); save(s); }
export function hasSeenAward(id)  { return (load().seenAwardIds ?? []).includes(id); }
export function markAwardSeen(id) { const s = load(); s.seenAwardIds = [id, ...(s.seenAwardIds ?? [])].slice(0, 5000); save(s); }
export function hasSeenNews(id)   { return (load().seenNewsIds ?? []).includes(id); }
export function markNewsSeen(id)  { const s = load(); s.seenNewsIds  = [id, ...(s.seenNewsIds  ?? [])].slice(0, 5000); save(s); }
export function hasSeenPoll(id)   { return (load().seenPollIds ?? []).includes(id); }
export function markPollSeen(id)  { const s = load(); s.seenPollIds  = [id, ...(s.seenPollIds  ?? [])].slice(0, 5000); save(s); }
export function pollSeenCount()   { return (load().seenPollIds ?? []).length; }

/** Bulk-mark polls seen without a save per id — used to bootstrap history. */
export function markPollsSeen(ids) {
  const s = load();
  s.seenPollIds = [...ids, ...(s.seenPollIds ?? [])].slice(0, 5000);
  save(s);
}
