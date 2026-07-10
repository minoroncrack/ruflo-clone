---
name: trump-scan
description: Scan Trump's Truth Social posts for market-moving keywords and alert on signals
---

# trump-scan command

**`trump-scan [--watch] [--score-threshold 40] [--limit 20]`** — Scan Trump's Truth Social for trade signals.

1. Spawn the `trump-scanner` agent
2. Call `mcp__Scrape_Creators__v1_truthsocial_user_posts` with `{ username: "realDonaldTrump", limit: <limit> }`
3. For each post: run keyword scoring engine (see `src/keywords.ts`)
4. Alert on posts with score ≥ `--score-threshold` (default 40)
5. Display scored results table: post preview | score | tickers | direction
6. If `--watch`: loop every 90s until CTRL+C

**Output format:**
```
📊 Trump Trade Scanner — Last scan: 2024-01-15T14:23:00Z
─────────────────────────────────────────────────────
[ALERT 🚨] Score: 78/100 — $DJT, ITA, defense
  "The military is going to be incredible. We're buying American..."
  Direction: 📈 BULLISH | Posted: 2 min ago

[WATCH  👀] Score: 35/100 — oil, XOP
  "Drill baby drill. Energy independence NOW..."
  Direction: 📈 BULLISH | Posted: 8 min ago

[SKIP   ⏭️] Score: 12/100 — no market keywords
  "Happy Thanksgiving to all..."
─────────────────────────────────────────────────────
2 new posts scanned | 1 alert | 1 watch | 1 skip
```
