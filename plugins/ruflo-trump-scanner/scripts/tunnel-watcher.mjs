#!/usr/bin/env node
/**
 * Watches the cloudflared tunnel log for its current trycloudflare.com URL
 * and emails it whenever it changes. Quick tunnels rotate to a new random
 * subdomain on every reconnect, so this keeps the dashboard link current
 * without manual intervention.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { dispatch } from '../src/alerts.mjs';

process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));

const LOG_FILE   = join(homedir(), '.pm2', 'logs', 'trump-tunnel-error.log');
const STATE_DIR  = join(dirname(fileURLToPath(import.meta.url)), '..', '.state');
const STATE_FILE = join(STATE_DIR, 'tunnel-url.json');
const TOKEN_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', '.dashboard-token');
const CHECK_INTERVAL = Number(process.env.TUNNEL_WATCH_INTERVAL_MS ?? 30_000);

function loadLastUrl() {
  try { return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf-8')).url : null; }
  catch { return null; }
}
function saveLastUrl(url) {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ url, ts: Date.now() }));
}
function loadToken() {
  try { return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8')).token; } catch { return null; }
}
function latestUrlFromLog() {
  if (!existsSync(LOG_FILE)) return null;
  const text = readFileSync(LOG_FILE, 'utf-8');
  const matches = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
  return matches ? matches[matches.length - 1] : null;
}

async function check() {
  const current = latestUrlFromLog();
  if (!current) return;
  const last = loadLastUrl();
  if (current === last) return;

  const token = loadToken();
  const fullUrl = token ? `${current}/?key=${token}` : current;
  console.log(`[${new Date().toISOString()}] New tunnel URL detected: ${fullUrl}`);
  await dispatch(
    '🔗 Dashboard URL updated',
    `The Cloudflare quick tunnel reconnected with a new address:\n\n${fullUrl}\n\nAny previous link is now dead — use this one.`
  );
  saveLastUrl(current);
}

console.log('🔗 Tunnel URL watcher starting...');
await check();
setInterval(check, CHECK_INTERVAL);
process.on('SIGINT', () => process.exit(0));
