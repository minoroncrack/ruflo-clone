# Trump Trade Scanner — Setup Guide

## Quick Start (5 minutes)

### 1. Install dependencies

```bash
cd plugins/ruflo-trump-scanner
npm install
```

### 2. Configure alert channels

Create `.env` in the plugin root (never commit this):

```bash
# ── OPTION A: ntfy.sh push notifications (FREE, recommended) ──────────
# Install ntfy app on your phone, subscribe to your topic
# Topic can be any unique string — keep it secret
NTFY_TOPIC=trump-scanner-your-secret-topic-here

# ── OPTION B: Discord webhook ─────────────────────────────────────────
# Discord → Server Settings → Integrations → Webhooks → Copy URL
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/XXXX/YYYY

# ── OPTION C: Slack webhook ───────────────────────────────────────────
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ

# ── OPTION D: Email (Gmail example) ──────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password      # Gmail → Security → App Passwords
ALERT_EMAIL_TO=your@gmail.com

# ── Timing (optional) ────────────────────────────────────────────────
POLL_INTERVAL_POSTS_MS=90000     # 90 seconds (default)
POLL_INTERVAL_CONTRACTS_MS=900000 # 15 minutes (default)
```

### 3. Start the scanner

```bash
npm run scan
```

You'll see:
```
🚨 Trump Trade Scanner starting...
  Truth Social poll: every 90s
  USASpending poll:  every 900s

[2024-01-15T14:00:00Z] Checking Truth Social...
  No new posts.
[2024-01-15T14:00:01Z] Checking USASpending.gov...
  No new qualifying contracts.
```

### 4. Run as a background service (optional)

**macOS/Linux (launchd/systemd):**
```bash
# Simple background run
nohup npm run scan > /tmp/trump-scanner.log 2>&1 &
tail -f /tmp/trump-scanner.log
```

**PM2 (recommended for persistence):**
```bash
npm install -g pm2
pm2 start scripts/scan-loop.mjs --name trump-scanner
pm2 logs trump-scanner
pm2 startup  # auto-restart on reboot
```

## Alert Channel Setup

### ntfy.sh (Recommended — Free, No Account Required)

1. Download the **ntfy** app on iOS or Android
2. Pick a secret topic name (e.g., `trump-scanner-abc123xyzq`)
3. In the app: tap **+** → enter your topic name → Subscribe
4. Set `NTFY_TOPIC=trump-scanner-abc123xyzq` in your `.env`
5. Test: `curl -d "test alert" ntfy.sh/trump-scanner-abc123xyzq`

Your phone will buzz the second the scanner fires. Free, no signup, works globally.

### Discord

1. Create a private Discord server
2. Server Settings → Integrations → Webhooks → New Webhook
3. Copy URL → set as `ALERT_WEBHOOK_URL`

### Zapier → SMS

1. In Zapier: Create Zap → Trigger: Webhooks by Zapier (Catch Hook)
2. Action: SMS by Zapier (or Twilio)
3. Set the Zapier webhook URL as `ALERT_WEBHOOK_URL`
4. You'll get a text message for every alert

## Using Inside Ruflo Agent

```bash
# One-time scan
npx ruflo trump-scan

# Continuous watch mode
npx ruflo trump-scan --watch

# Contract scanner
npx ruflo contracts --sector defense --min-amount 50000000 --watch
```

## Understanding the Scores

| Score | Action |
|-------|--------|
| 70-100 | 🚨 **ACT NOW** — direct mention, move likely within 60 seconds |
| 40-69  | ⚡ **Research fast** — sector play, 2-10 min before retail catches on |
| 20-39  | 👀 **Watch** — ambiguous, wait for confirmation |
| 0-19   | ⏭️ Skip — no market relevance |

## What to Do When You Get an Alert

### Trump Signal (score 70+)
1. Open Robinhood/IBKR immediately
2. Check the pre-market/level 2 on flagged ticker
3. Look at options chain — IV will spike
4. Consider: shares for slow move, calls for fast move
5. Set a stop-loss — these can reverse fast

### Contract Alert
1. Search the company name on Finviz, Bloomberg
2. Check market cap — $50M contract on a $200M company = 25% revenue bump
3. Check float — small float = larger move
4. Look at options availability — many small caps are shares-only
5. Set alert for news/PR from the company confirming the award

## Data Sources

| Source | URL | Latency |
|--------|-----|---------|
| Truth Social RSS | truthsocial.com/@realDonaldTrump.rss | ~30 seconds |
| USASpending API | api.usaspending.gov | 2-4 hours post-award |

## Legal Note

This scanner uses only public data sources (public RSS feeds, public government APIs).
No authentication, scraping of paywalled content, or private data is involved.
Trade based on your own research and risk tolerance.
