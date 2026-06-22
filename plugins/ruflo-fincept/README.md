# ruflo-fincept

Fincept Terminal integration — Ruflo thinks, [Fincept](https://github.com/Fincept-Corporation/FinceptTerminal) provides the data.

**Fincept Terminal**: https://github.com/Fincept-Corporation/FinceptTerminal

## Architecture

Ruflo owns all reasoning, decisions, and agent coordination. Fincept Terminal acts as a Bloomberg-style data terminal — it provides advanced market analytics, investment research, and economic data tools for interactive exploration and data-driven decision making. Ruflo queries it; Fincept responds.

```
Ruflo agents (think) ──→ Fincept Terminal MCP (data/analytics/execution)
  market-analyst             equity_research, dcf_model, edgar_filings
  portfolio-manager          live_trade, paper_trade, broker_account
  quant-researcher           quantlib_price, quantlib_risk, surface_analytics
  macro-economist            fred_data, dbnomics, imf_data, world_bank
```

## Agents (renamed — Ruflo owns reasoning)

| Agent | Role |
|-------|------|
| `market-analyst` | Equity research, DCF, fundamentals |
| `portfolio-manager` | Trading decisions and execution routing |
| `quant-researcher` | Derivatives pricing, risk, vol surfaces |
| `macro-economist` | Macro regime analysis, economic data |

## Source

Fincept Terminal source is at `fincept-terminal/` (repo root). Build with:

```bash
cd fincept-terminal && bash setup.sh
```

Or with Docker:

```bash
docker build -t fincept-terminal fincept-terminal/
```

## Installation

```bash
claude --plugin-dir plugins/ruflo-fincept
```

## Agents

| Agent | Model | Role |
|-------|-------|------|
| `fincept-analyst` | sonnet | Equity research, DCF models, financial statement analysis via Fincept MCP |
| `fincept-trader` | sonnet | Live and paper trading coordination across 16 broker integrations |
| `fincept-quant` | opus | QuantLib suite — pricing, risk, stochastic models, volatility surfaces |
| `fincept-macro` | sonnet | Macroeconomic data from DBnomics, FRED, IMF, World Bank, government APIs |

## Skills

| Skill | Usage | Description |
|-------|-------|-------------|
| `fincept-research` | `/fincept-research <ticker>` | Run equity research with DCF model via Fincept |
| `fincept-portfolio` | `/fincept-portfolio [action]` | Portfolio optimization and risk metrics (VaR, Sharpe) |
| `fincept-trade` | `/fincept-trade <symbol> <action>` | Place or simulate trades via broker integrations |
| `fincept-macro` | `/fincept-macro <indicator>` | Fetch macro data from 100+ data connectors |
| `fincept-quant` | `/fincept-quant <model>` | Run QuantLib pricing and risk models |

## Commands (6 subcommands)

```bash
fincept research <ticker>           # Equity research + DCF model
fincept portfolio [optimize|risk]   # Portfolio analytics
fincept trade <symbol> <buy|sell>   # Execute via broker
fincept macro <indicator>           # Macro data lookup
fincept quant <model> [--params]    # Quantitative model run
fincept status                      # MCP bridge health check
```

## MCP Bridge

When Fincept Terminal is running, Ruflo connects to its MCP server. Configure the endpoint:

```bash
# Add Fincept MCP to Claude
claude mcp add fincept-terminal npx -y fincept-terminal-mcp
# or if running locally
claude mcp add fincept-terminal localhost:3001
```

## Fincept MCP Tools Available

| Category | Tools |
|----------|-------|
| Equity Research | `equity_research`, `dcf_model`, `edgar_filings` |
| Portfolio | `portfolio_optimize`, `portfolio_risk`, `watchlist` |
| Trading | `live_trade`, `paper_trade`, `crypto_trade`, `broker_account` |
| Macro Data | `dbnomics`, `fred_data`, `imf_data`, `world_bank`, `gov_data` |
| Quant | `quantlib_price`, `quantlib_risk`, `surface_analytics`, `quant_lab` |
| AI Agents | `run_agent`, `agent_discovery`, `agents_repos` |
| News | `news_search`, `forum_data`, `geopolitics` |
| System | `python_exec`, `workspace`, `dashboard`, `settings` |

## AI Agents (37 built-in)

Fincept ships 37 AI agents across three frameworks. Invoke them via the `fincept-trader` agent:

- **Trader/Investor**: Buffett, Graham, Lynch, Munger, Klarman, Marks (value), plus momentum and quant styles
- **Economic**: macro analysis, central bank monitoring, yield curve interpretation
- **Geopolitics**: geopolitical risk scoring, sanctions monitoring, regime change indicators

## Data Connectors (100+)

DBnomics · Polygon · Kraken · Yahoo Finance · FRED · IMF · World Bank · AkShare · government APIs · Adanos sentiment

## Broker Integrations (16)

Zerodha · Angel One · Upstox · Fyers · Dhan · Groww · Kotak · IIFL · 5paisa · AliceBlue · Shoonya · Motilal · IBKR · Alpaca · Tradier · Saxo
