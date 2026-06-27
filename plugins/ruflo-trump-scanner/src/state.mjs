/**
 * Persistent seen-IDs state so the scanner never double-alerts after restart.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR   = join(dirname(fileURLToPath(import.meta.url)), '..', '.state');
const FILE  = join(DIR, 'seen.json');
const EMPTY = { seenPostIds: [], seenAwardIds: [] };

function load() {
  try { return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf-8')) : { ...EMPTY }; }
  catch { return { ...EMPTY }; }
}

function save(s) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(s, null, 2));
}

export function hasSeenPost(id)   { return load().seenPostIds.includes(id); }
export function markPostSeen(id)  { const s = load(); s.seenPostIds  = [id, ...s.seenPostIds].slice(0, 5000);  save(s); }
export function hasSeenAward(id)  { return load().seenAwardIds.includes(id); }
export function markAwardSeen(id) { const s = load(); s.seenAwardIds = [id, ...s.seenAwardIds].slice(0, 5000); save(s); }
