---
name: fincept-macro
description: Fetch macroeconomic data from 100+ connectors and generate regime analysis
usage: /fincept-macro <indicator|country|sector> [--source fred|dbnomics|imf|worldbank]
---

# Fincept Macro Skill

Aggregate and interpret macroeconomic data via Fincept Terminal's 100+ data connectors.

## Usage

```
/fincept-macro US CPI
/fincept-macro yield-curve
/fincept-macro Germany GDP --source dbnomics
/fincept-macro global-pmi
```

## Available Queries

- `yield-curve` — US Treasury yield curve with shape classification
- `<country> GDP` — GDP growth, forecasts, revisions
- `<country> CPI` — Inflation data and trend
- `global-pmi` — Manufacturing and services PMI dashboard
- `credit-spreads` — HY/IG spreads and financial conditions
- `<country> employment` — Jobs data and labor market health
- `geopolitical-risk` — GPR index and regional risk scores

## Sources

| Source | Command | Best For |
|--------|---------|---------|
| FRED | `--source fred` | US macro (800k+ series) |
| DBnomics | `--source dbnomics` | Global (100k+ series, 70+ providers) |
| IMF | `--source imf` | WEO forecasts, BOP data |
| World Bank | `--source worldbank` | Long-run development indicators |
| AkShare | `--source akshare` | China / Asian markets |

## Output

- Current reading vs. consensus vs. prior
- 12-month trend chart (ASCII or data)
- Regime implication for equity/fixed income
- Related indicators to watch
