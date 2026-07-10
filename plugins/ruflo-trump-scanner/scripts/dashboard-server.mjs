#!/usr/bin/env node
/**
 * Signal Desk — local dashboard server (zero dependencies).
 *
 *   node scripts/dashboard-server.mjs
 *   pm2 start scripts/dashboard-server.mjs --name trump-dashboard
 *
 * Serves the dashboard UI and the scanner's real feed from one origin so the
 * browser can fetch it. Reads NTFY_TOPIC server-side only (never sent to the
 * client) to proxy live push as same-origin SSE at /api/stream.
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML  = join(ROOT, 'dashboard', 'index.html');
const DATA  = join(ROOT, 'data');
const FEED  = join(DATA, 'feed.json');
const POS   = join(DATA, 'positions.json');
const HIST  = join(DATA, 'quote-history.json');
const OUT   = join(DATA, 'outcomes.json');
const HEART = join(DATA, 'heartbeat.json');
const ENVF  = join(ROOT, '.env');
const PORT  = Number(process.env.DASHBOARD_PORT ?? 4717);

function readJSON(f, fallback) { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf-8')) : fallback; } catch { return fallback; } }
function writeJSON(f, v) { try { if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true }); writeFileSync(f, JSON.stringify(v)); } catch (e) { console.error('write', f, e.message); } }

/** Read a single key from process.env or the plugin .env (server-side only). */
function envValue(key) {
  if (process.env[key]) return process.env[key];
  try {
    if (existsSync(ENVF)) {
      for (const line of readFileSync(ENVF, 'utf-8').split('\n')) {
        const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`));
        if (m) return m[1].replace(/^["']|["']$/g, '');
      }
    }
  } catch {}
  return '';
}

const NTFY_TOPIC = envValue('NTFY_TOPIC');

// Access token: local + private-LAN requests are trusted; only public ones need ?key=.
function loadToken() {
  const env = envValue('DASHBOARD_TOKEN'); if (env) return env;
  const tf = join(DATA, '.dashboard-token');
  const stored = readJSON(tf, null); if (stored?.token) return stored.token;
  const t = crypto.randomBytes(9).toString('hex'); writeJSON(tf, { token: t }); return t;
}
const ACCESS_TOKEN = loadToken();
function isTrusted(ip) {
  if (!ip) return false; ip = ip.replace('::ffff:', '');
  return ip === '127.0.0.1' || ip === '::1' || /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

function readFeed() {
  try { return existsSync(FEED) ? JSON.parse(readFileSync(FEED, 'utf-8')) : []; }
  catch { return []; }
}

function readPositions() {
  try { return existsSync(POS) ? JSON.parse(readFileSync(POS, 'utf-8')) : []; }
  catch { return []; }
}

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
const FINNHUB_KEY = envValue('FINNHUB_KEY');

/** Append a (time, price) sample to local quote history (capped per ticker). */
function recordHistory(sym, price) {
  if (!Number.isFinite(price)) return;
  const h = readJSON(HIST, {});
  const arr = h[sym] || [];
  const last = arr[arr.length - 1];
  if (!last || Date.now() - last[0] > 60_000) {      // at most one point/min
    arr.push([Date.now(), price]);
    h[sym] = arr.slice(-400);
    writeJSON(HIST, h);
  }
}

/** Live quote + intraday series via Yahoo (keyless); Finnhub fallback. Cached 20s. */
const quoteCache = new Map();
async function quoteFull(ticker) {
  const key = ticker.toUpperCase();
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.t < 20_000) return hit.q;
  let q = null;
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${key}?range=1d&interval=5m&includePrePost=true`, { headers: UA });
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    if (res?.meta?.regularMarketPrice) {
      const m = res.meta;
      const closes = (res.indicators?.quote?.[0]?.close || []).filter(v => v != null);
      const ts = res.timestamp || [];
      const price = m.regularMarketPrice, prev = m.chartPreviousClose ?? m.previousClose ?? price;
      const state = m.marketState;                   // PRE, REGULAR, POST, CLOSED
      const ext = state === 'PRE' ? m.preMarketPrice : (state === 'POST' ? m.postMarketPrice : null);
      q = {
        price, prev, change: price - prev, changePct: prev ? ((price - prev) / prev) * 100 : 0,
        currency: m.currency, exchange: m.fullExchangeName,
        dayHigh: m.regularMarketDayHigh, dayLow: m.regularMarketDayLow,
        marketState: state, extPrice: Number.isFinite(ext) ? ext : null,
        extPct: Number.isFinite(ext) && price ? ((ext - price) / price) * 100 : null,
        series: closes.slice(-90), times: ts.slice(-90), source: 'yahoo',
      };
    }
  } catch {}
  // Finnhub fallback (needs FINNHUB_KEY); fills price only.
  if (!q && FINNHUB_KEY) {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${key}&token=${FINNHUB_KEY}`);
      const j = await r.json();
      if (j && j.c) q = { price: j.c, prev: j.pc, change: j.c - j.pc, changePct: j.pc ? ((j.c - j.pc) / j.pc) * 100 : 0,
        dayHigh: j.h, dayLow: j.l, series: [], times: [], marketState: 'REGULAR', extPrice: null, extPct: null, source: 'finnhub' };
    } catch {}
  }
  quoteCache.set(key, { q, t: Date.now() });
  if (q) recordHistory(key, q.price);
  return q;
}
async function quote(ticker) { const q = await quoteFull(ticker); return q ? q.price : null; }

/** Real news headlines for a ticker via Yahoo search (keyless). Cached 5m. */
const newsCache = new Map();
async function newsFor(ticker) {
  const key = ticker.toUpperCase();
  const hit = newsCache.get(key);
  if (hit && Date.now() - hit.t < 300_000) return hit.n;
  let n = [];
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${key}&newsCount=8&quotesCount=0`, { headers: UA });
    const j = await r.json();
    n = (j?.news || []).map(x => ({
      title: x.title, publisher: x.publisher, link: x.link,
      ts: (x.providerPublishTime || 0) * 1000,
    }));
  } catch {}
  newsCache.set(key, { n, t: Date.now() });
  return n;
}

/** Aggregate everything the detail panel needs for one ticker. */
async function tickerDetail(sym) {
  const key = sym.toUpperCase();
  const [q, news] = await Promise.all([quoteFull(key), newsFor(key)]);
  const feed = readFeed().filter(e => Array.isArray(e.tickers) && e.tickers.includes(key));
  const signals = feed.filter(e => e.kind !== 'contract');
  const trumpWords = signals.slice(0, 12).map(e => ({ ts: e.ts, body: e.body, score: e.score, subject: e.subject }));
  const scoreSeries = signals.slice(0, 40).map(e => ({ ts: e.ts, score: e.score })).reverse();
  const pos = readPositions().find(p => p.ticker.toUpperCase() === key) || null;
  return {
    ticker: key, quote: q, news,
    stats: {
      mentions: signals.length,
      peakScore: signals.reduce((m, e) => Math.max(m, e.score || 0), 0),
      lastMention: signals[0]?.ts || null,
      hasGov: feed.some(e => e.kind === 'contract'),
      hasSocial: signals.length > 0,
    },
    trumpWords, scoreSeries, position: pos,
    history: (readJSON(HIST, {})[key] || []).slice(-200),
    truthProfile: 'https://truthsocial.com/@realDonaldTrump',
    asOf: Date.now(),
  };
}

/* ---- signal → return tracking (real, honest track record) ---- */
async function evalOutcomes() {
  const feed = readFeed().filter(e => e.kind !== 'contract' && Array.isArray(e.tickers) && e.tickers.length);
  const out = readJSON(OUT, {});
  let changed = false;
  for (const e of feed.slice(0, 120)) {
    const sym = e.tickers[0].toUpperCase();
    const id = e.ts + '_' + sym;
    let rec = out[id];
    const ageH = (Date.now() - e.ts) / 3_600_000;
    if (!rec) {
      const q = await quoteFull(sym);
      if (!q) continue;
      const ageMin = (Date.now() - e.ts) / 60_000;
      rec = { ts: e.ts, sym, score: e.score, entryPx: q.price, entryApprox: ageMin > 10, ret1h: null, ret1d: null };
      out[id] = rec; changed = true;
    }
    if (rec.ret1h == null && ageH >= 1) { const q = await quoteFull(sym); if (q) { rec.ret1h = (q.price - rec.entryPx) / rec.entryPx * 100; changed = true; } }
    if (rec.ret1d == null && ageH >= 24) { const q = await quoteFull(sym); if (q) { rec.ret1d = (q.price - rec.entryPx) / rec.entryPx * 100; changed = true; } }
  }
  if (changed) writeJSON(OUT, out);
}
function statsSummary() {
  const recs = Object.values(readJSON(OUT, {})).sort((a, b) => b.ts - a.ts);
  const d1 = recs.filter(r => r.ret1d != null);
  const h1 = recs.filter(r => r.ret1h != null);
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  return {
    tracked: recs.length,
    settled1d: d1.length,
    hitRate1d: d1.length ? d1.filter(r => r.ret1d > 0).length / d1.length * 100 : null,
    avgRet1d: avg(d1.map(r => r.ret1d)),
    avgRet1h: avg(h1.map(r => r.ret1h)),
    recent: recs.slice(0, 8).map(r => ({ sym: r.sym, score: r.score, ts: r.ts, ret1h: r.ret1h, ret1d: r.ret1d, approx: r.entryApprox })),
  };
}

/* ---- end-of-day summary push via ntfy ---- */
let lastEod = '';
async function maybeEod() {
  if (!NTFY_TOPIC) return;
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(), mins = et.getHours() * 60 + et.getMinutes();
  const stamp = et.toISOString().slice(0, 10);
  if (day >= 1 && day <= 5 && mins >= 965 && mins < 980 && lastEod !== stamp) {  // ~16:05 ET
    lastEod = stamp;
    const since = Date.now() - 86_400_000;
    const today = readFeed().filter(e => e.ts >= since);
    const sigs = today.filter(e => e.kind !== 'contract');
    const top = sigs.slice().sort((a, b) => b.score - a.score)[0];
    const body = `Signals: ${sigs.length} · Contracts: ${today.length - sigs.length}` +
      (top ? `\nTop: [${top.score}] ${(top.tickers || []).map(t => '$' + t).join(' ')}` : '\nNo signals today.');
    try {
      await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, { method: 'POST',
        headers: { Title: 'Signal Desk — EOD Recap', Tags: 'chart_with_upwards_trend', Priority: 'default' }, body });
    } catch {}
  }
}

/** Enrich positions with last price + P&L and roll up book totals. */
async function buildBook() {
  const rows = readPositions();
  const enriched = await Promise.all(rows.map(async r => {
    // price source: live quote → manual `last` → entry (stale).
    // Live is primary so the book moves in real time; manual is an offline fallback.
    const live = await quote(r.ticker);
    const manual = Number.isFinite(r.last) && r.last > 0 ? r.last : null;
    const px = live ?? manual ?? r.entry;
    const source = live != null ? 'live' : manual != null ? 'manual' : 'entry';
    const mktVal = px * r.qty;
    const cost = r.entry * r.qty;
    const pnl = mktVal - cost;
    return {
      ...r, last: px, source,
      mktVal, cost, pnl,
      pnlPct: cost ? (pnl / cost) * 100 : 0,
      stale: source === 'entry',
    };
  }));
  // Book totals only sum positions we actually have a real mark for.
  const priced = enriched.filter(r => !r.stale);
  const cost = priced.reduce((s, r) => s + r.cost, 0);
  const mktVal = priced.reduce((s, r) => s + r.mktVal, 0);
  const pnl = mktVal - cost;
  return {
    positions: enriched,
    totals: { cost, mktVal, pnl, pnlPct: cost ? (pnl / cost) * 100 : 0, pricedCount: priced.length, total: enriched.length },
    asOf: Date.now(),
  };
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

/** Proxy ntfy SSE -> browser SSE, so the topic stays on the server. */
async function streamNtfy(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ topic: !!NTFY_TOPIC })}\n\n`);
  const ka = setInterval(() => res.write(': keepalive\n\n'), 25_000);

  if (!NTFY_TOPIC) { res.on('close', () => clearInterval(ka)); return; }

  const ctrl = new AbortController();
  res.on('close', () => { clearInterval(ka); ctrl.abort(); });

  try {
    const up = await fetch(`https://ntfy.sh/${NTFY_TOPIC}/sse`, { signal: ctrl.signal });
    const reader = up.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const blocks = buf.split('\n\n'); buf = blocks.pop() ?? '';
      for (const b of blocks) {
        const data = b.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
        if (data) res.write(`event: alert\ndata: ${data}\n\n`);
      }
    }
  } catch { /* aborted or upstream closed */ }
}

function readBody(req) {
  return new Promise(resolve => { let b = ''; req.on('data', c => b += c); req.on('end', () => resolve(b)); });
}

createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // ---- access gate: direct local/LAN open; anything via a proxy/tunnel needs ?key= ----
  // Tunnel traffic arrives from 127.0.0.1 but carries forwarding headers, so a raw
  // socket check isn't enough — treat any proxied request as untrusted.
  const viaProxy = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
  if (viaProxy || !isTrusted(req.socket.remoteAddress)) {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const cookie = req.headers.cookie || '';
    const ok = params.get('key') === ACCESS_TOKEN || cookie.includes('sd_key=' + ACCESS_TOKEN);
    if (!ok) {
      const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signal Desk — Unlock</title><style>
body{margin:0;height:100vh;display:grid;place-items:center;background:#121212;color:#fff;font-family:-apple-system,system-ui,sans-serif}
.card{background:#1C1C1E;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:34px 28px;width:300px;text-align:center}
.dot{width:34px;height:34px;border-radius:9px;background:#1C1C1E;border:1px solid rgba(255,255,255,.15);display:grid;place-items:center;margin:0 auto 16px}
.dot b{width:9px;height:9px;border-radius:50%;background:#ff6a1f;box-shadow:0 0 12px #ff6a1f;display:block}
h1{font-size:17px;margin:0 0 4px}p{color:#9a9aa3;font-size:12px;margin:0 0 18px}
input{width:100%;box-sizing:border-box;background:#252528;border:1px solid rgba(255,255,255,.12);color:#fff;
font-family:ui-monospace,monospace;font-size:14px;padding:12px;border-radius:10px;outline:none;text-align:center;letter-spacing:.04em}
input:focus{border-color:#ff6a1f}button{width:100%;margin-top:10px;background:#ff6a1f;color:#1a0d00;border:0;font-weight:700;
font-size:14px;padding:12px;border-radius:10px;cursor:pointer}</style></head>
<body><form class="card" method="GET" action="/"><div class="dot"><b></b></div>
<h1>Signal Desk</h1><p>Enter your access token to continue</p>
<input name="key" placeholder="access token" autofocus autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="latin">
<button type="submit">Unlock</button></form></body></html>`;
      return send(res, 401, 'text/html; charset=utf-8', page);
    }
    if (params.get('key') === ACCESS_TOKEN && (url === '/' || url === '/index.html')) {
      res.setHeader('Set-Cookie', `sd_key=${ACCESS_TOKEN}; Path=/; Max-Age=2592000; SameSite=Lax`);
    }
  }

  // ---- position writes (local only) ----
  if (req.method === 'POST' && url === '/api/positions') {
    try {
      const { action, ticker, qty, entry } = JSON.parse(await readBody(req) || '{}');
      let list = readJSON(POS, []);
      const sym = String(ticker || '').toUpperCase().replace(/[^A-Z.]/g, '');
      if (!sym) throw new Error('ticker required');
      if (action === 'remove') list = list.filter(p => p.ticker.toUpperCase() !== sym);
      else { list = list.filter(p => p.ticker.toUpperCase() !== sym);
        list.push({ ticker: sym, qty: Number(qty) || 0, entry: Number(entry) || 0 }); }
      writeJSON(POS, list);
      return send(res, 200, 'application/json', JSON.stringify({ ok: true, positions: list }));
    } catch (e) { return send(res, 400, 'application/json', JSON.stringify({ error: e.message })); }
  }

  if (url === '/' || url === '/index.html') {
    if (!existsSync(HTML)) return send(res, 404, 'text/plain', 'dashboard/index.html not found');
    return send(res, 200, 'text/html; charset=utf-8', readFileSync(HTML));
  }
  if (url === '/api/feed')   return send(res, 200, 'application/json', JSON.stringify(readFeed()));
  if (url === '/api/book')   return send(res, 200, 'application/json', JSON.stringify(await buildBook()));
  if (url === '/api/ticker') {
    const sym = new URLSearchParams(req.url.split('?')[1] || '').get('sym');
    if (!sym) return send(res, 400, 'application/json', '{"error":"sym required"}');
    return send(res, 200, 'application/json', JSON.stringify(await tickerDetail(sym)));
  }
  if (url === '/api/quotes') {
    const syms = (new URLSearchParams(req.url.split('?')[1] || '').get('syms') || '')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 25);
    const out = {};
    await Promise.all(syms.map(async s => {
      const q = await quoteFull(s);
      if (q) out[s] = { price: q.price, change: q.change, changePct: q.changePct };
    }));
    return send(res, 200, 'application/json', JSON.stringify({ quotes: out, asOf: Date.now() }));
  }
  if (url === '/api/stats') return send(res, 200, 'application/json', JSON.stringify(statsSummary()));
  if (url === '/api/health') {
    const hb = readJSON(HEART, null);
    return send(res, 200, 'application/json', JSON.stringify({
      ok: true, ntfyConfigured: !!NTFY_TOPIC, feedExists: existsSync(FEED), now: Date.now(),
      scannerLast: hb?.ts || null, scannerSource: hb?.source || null,
    }));
  }
  if (url === '/api/stream') return streamNtfy(res);
  return send(res, 404, 'text/plain', 'Not found');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Signal Desk  →  http://localhost:${PORT}  (also on your LAN IP)`);
  console.log(`  ntfy push    →  ${NTFY_TOPIC ? 'configured (proxied)' : 'not set'}`);
  console.log(`  quote backup →  ${FINNHUB_KEY ? 'Finnhub key present' : 'Yahoo only'}`);
  console.log(`  remote token →  ${ACCESS_TOKEN}  (only needed for public/tunnel access)\n`);
});

// background jobs — always running
evalOutcomes(); setInterval(evalOutcomes, 60_000);
setInterval(maybeEod, 60_000);
