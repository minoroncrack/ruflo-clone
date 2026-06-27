---
name: contracts
description: Monitor USASpending.gov for $50M+ contract awards to small/mid-cap defense, medical, and tech companies
---

# contracts command

**`contracts [--days 1] [--min-amount 50000000] [--sector defense,medical,tech] [--watch]`** — Scan USASpending.gov for contract signals.

1. Spawn the `contract-watcher` agent
2. Query USASpending.gov API for contracts matching filters
3. Filter out large-cap recipients
4. Display results with company, amount, sector, ticker research
5. Alert via configured channels (email, webhook, ntfy)

**Output format:**
```
📋 USASpending Contract Scanner — Last: 2024-01-15T14:00:00Z
─────────────────────────────────────────────────────────
🛡️  DEFENSE — SMALL CAP
    Acme Defense Systems Inc  →  $127,500,000
    Agency: Dept of Defense, Army
    NAICS: 336414 — Guided Missile Manufacturing
    State: Virginia
    ⚠️  Not yet indexed by Bloomberg. Ticker research needed.

💊  MEDICAL — SMALL CAP
    BioShield Medical LLC  →  $68,200,000
    Agency: Dept of Health and Human Services
    NAICS: 325414 — Biological Product Manufacturing
    State: Maryland
─────────────────────────────────────────────────────────
2 qualifying contracts found | $195.7M total
```
