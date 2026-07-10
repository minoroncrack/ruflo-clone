/**
 * Persistent seen-post / seen-award state.
 * Stored as JSON on disk so the scanner survives restarts without re-alerting.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, '..', '.state');
const STATE_FILE = join(STATE_DIR, 'seen.json');

interface State {
  seenPostIds: string[];
  seenAwardIds: string[];
  lastPostCheck: string;
  lastContractCheck: string;
}

const DEFAULT_STATE: State = {
  seenPostIds: [],
  seenAwardIds: [],
  lastPostCheck: new Date(0).toISOString(),
  lastContractCheck: new Date(0).toISOString(),
};

function load(): State {
  if (!existsSync(STATE_FILE)) return { ...DEFAULT_STATE };
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as State;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function save(state: State): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function hasSeenPost(postId: string): boolean {
  return load().seenPostIds.includes(postId);
}

export function markPostSeen(postId: string): void {
  const state = load();
  if (!state.seenPostIds.includes(postId)) {
    state.seenPostIds = [postId, ...state.seenPostIds].slice(0, 5000);
    state.lastPostCheck = new Date().toISOString();
    save(state);
  }
}

export function hasSeenAward(awardId: string): boolean {
  return load().seenAwardIds.includes(awardId);
}

export function markAwardSeen(awardId: string): void {
  const state = load();
  if (!state.seenAwardIds.includes(awardId)) {
    state.seenAwardIds = [awardId, ...state.seenAwardIds].slice(0, 5000);
    state.lastContractCheck = new Date().toISOString();
    save(state);
  }
}

export function getStats(): State {
  return load();
}
