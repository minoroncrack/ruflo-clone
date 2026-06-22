---
name: fincept
description: Fincept Terminal integration — equity research, portfolio, trading, macro data, and QuantLib quant models
---
$ARGUMENTS
Manage Fincept Terminal integration. Parse subcommand from $ARGUMENTS.

Usage: /fincept <subcommand> [options]

Subcommands:
- `research <ticker> [--depth quick|full] [--agent buffett|graham|lynch|munger]` -- Run equity research with DCF model
- `portfolio [optimize|risk|rebalance] [--method mv|bl|rp]` -- Portfolio analytics and optimization
- `trade <symbol> <buy|sell> [--qty N] [--broker NAME] [--paper]` -- Execute or simulate trade
- `macro <indicator|country> [--source fred|dbnomics|imf|worldbank]` -- Fetch macroeconomic data
- `quant <model> [--params key=val]` -- Run QuantLib pricing or risk model
- `status` -- Check Fincept Terminal MCP bridge health

Steps by subcommand:

**research**:
1. Spawn `fincept-analyst` agent: research + DCF + EDGAR filings
2. If `--agent` flag provided, also invoke Fincept built-in investor agent via `mcp__fincept-terminal__run_agent`
3. Return structured report: recommendation, price target, DCF value, key risks
4. Store result: `npx claude-flow@latest memory store --key "research-TICKER-DATE" --namespace fincept-research`

**portfolio**:
For `optimize`:
1. Fetch current holdings via `mcp__fincept-terminal__watchlist`
2. Run optimization via `mcp__fincept-terminal__portfolio_optimize` with specified method
3. Return efficient frontier or Black-Litterman weights

For `risk`:
1. Fetch portfolio via `mcp__fincept-terminal__portfolio_risk`
2. Run QuantLib VaR/CVaR via `mcp__fincept-terminal__quantlib_risk`
3. Run stress tests (2008, 2020, 2022 scenarios)
4. Return full risk report

For `rebalance`:
1. Compute delta between current and target allocation
2. Generate minimum-cost rebalancing trades
3. Show trades needed with estimated costs

**trade**:
1. Run analyst → quant → trader pipeline (unless `--paper` and qty < 0.1% portfolio)
2. `fincept-analyst` validates thesis
3. `fincept-quant` computes position size, VaR, stop-loss
4. `fincept-trader` executes via `mcp__fincept-terminal__live_trade` or `mcp__fincept-terminal__paper_trade`
5. Store trade record: `npx claude-flow@latest memory store --key "trade-ID" --namespace fincept-trades`

**macro**:
1. Route to appropriate data connector based on `--source` flag
2. Fetch time series and latest reading
3. Classify macro regime (expansion/slowdown/contraction/recovery)
4. Return dashboard with trend, consensus, sector implications

**quant**:
1. Parse model name and parameters from $ARGUMENTS
2. Call `mcp__fincept-terminal__quantlib_price` or `mcp__fincept-terminal__quantlib_risk`
3. For Python models: use `mcp__fincept-terminal__python_exec`
4. Return pricing output, Greeks, or risk metrics

**status**:
1. Check Fincept Terminal MCP endpoint (from FINCEPT_MCP_ENDPOINT env or default localhost:3001)
2. List available MCP tools from the running instance
3. Report broker connection status and account info
4. Show last trade and research timestamps from memory
