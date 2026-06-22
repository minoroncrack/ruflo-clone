---
name: fincept-research
description: Run institutional-grade equity research with DCF model via Fincept Terminal
usage: /fincept-research <ticker> [--depth full|quick] [--agent buffett|graham|lynch]
---

# Fincept Research Skill

Run a full equity research report for a ticker using Fincept Terminal's AI and data infrastructure.

## Usage

```
/fincept-research AAPL
/fincept-research MSFT --depth full
/fincept-research BRK.B --agent buffett
```

## Steps

1. Spawn `fincept-analyst` agent
2. Fetch financial data via `mcp__fincept-terminal__equity_research`
3. Build DCF model via `mcp__fincept-terminal__dcf_model`
4. Pull EDGAR filings via `mcp__fincept-terminal__edgar_filings`
5. Get news sentiment via `mcp__fincept-terminal__news_search`
6. Optionally run a Fincept investor-style agent (--agent flag)
7. Return structured research report

## Output

- Executive summary with recommendation (Buy/Hold/Sell)
- Price target with DCF-derived intrinsic value
- Financial model (revenue, margins, FCF, debt)
- Risk factors (business, valuation, macro)
- Analyst agent commentary (if --agent specified)
