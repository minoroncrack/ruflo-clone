---
name: trump-scanner
description: Trump Trade Scanner skill — monitors Truth Social and USASpending.gov for market-moving signals
trigger: when user asks about trump trades, political trading, truth social stocks, government contracts, defense contracts
---

# Trump Trade Scanner Skill

When this skill is triggered:

## Quick Scan (one-time)

1. Fetch latest 20 Trump Truth Social posts via `mcp__Scrape_Creators__v1_truthsocial_user_posts`
2. Score each post with the keyword engine
3. Show scored results
4. Check USASpending.gov for contracts in the last 24h
5. Report combined signal dashboard

## Watch Mode (continuous)

Spawn the `trump-scanner` and `contract-watcher` agents as background tasks:

```javascript
Task({
  prompt: `You are monitoring Trump's Truth Social continuously. 
  Every 90 seconds, call mcp__Scrape_Creators__v1_truthsocial_user_posts with username "realDonaldTrump" limit 10.
  Score each new post. Alert (via console and configured webhook/email) on any post scoring >= 40.
  Track seen post IDs to avoid duplicates. Run indefinitely until shutdown_request received.`,
  subagent_type: 'trump-scanner',
  name: 'truth-watcher',
  run_in_background: true
})

Task({
  prompt: `You are monitoring USASpending.gov for contract awards continuously.
  Every 15 minutes, call the USASpending API for new $50M+ contracts in defense/medical/tech NAICS codes.
  Filter out large caps. Alert on qualifying awards.
  Run indefinitely until shutdown_request received.`,
  subagent_type: 'contract-watcher', 
  name: 'contract-watcher',
  run_in_background: true
})
```

## Signal Interpretation Guide

### High-urgency signals (score 70+)
- Direct ticker mention ($XXX)
- Company name + positive sentiment
- Signed executive order or deal
→ **Act in first 60 seconds** — retail follows within 2-3 minutes

### Medium signals (score 40-69)
- Sector keyword + sentiment booster
- Policy announcement affecting specific industry
→ **Research within 5 minutes** — options, sector ETFs, related names

### Watch list (score 20-39)
- Sector keyword only
- Ambiguous statement
→ **Monitor for follow-up** — set alert for related news

## USASpending Edge

Contracts are posted to USASpending typically within 2-4 hours of award.
Most small-cap stocks won't move for 12-48 hours until news aggregators pick it up.
This gives a 12-48 hour window to accumulate before the move.

### Finding the ticker
1. Search "[company name] stock" or "[company name] SEC filing"
2. Check SEC EDGAR: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany
3. Check if subsidiary of public company (common with defense contractors)
4. If private: look for supplier/partner relationships with public companies
