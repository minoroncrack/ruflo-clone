---
name: fincept-portfolio
description: Portfolio optimization and risk metrics via Fincept Terminal QuantLib suite
usage: /fincept-portfolio [optimize|risk|rebalance] [--method mv|bl|rp]
---

# Fincept Portfolio Skill

Run portfolio optimization and risk analytics via Fincept Terminal's QuantLib-backed portfolio engine.

## Usage

```
/fincept-portfolio optimize --method mv
/fincept-portfolio risk
/fincept-portfolio rebalance --target 60/40
```

## Actions

### optimize
Mean-variance, Black-Litterman, or risk-parity optimization.

Methods:
- `mv` — Markowitz mean-variance (efficient frontier)
- `bl` — Black-Litterman with user views
- `rp` — Risk parity (equal risk contribution)

### risk
Full risk report: VaR, CVaR, Sharpe, max drawdown, factor exposures.

Risk metrics computed:
- VaR (95%, 99%) — historical, parametric, Monte Carlo
- CVaR / Expected Shortfall
- Sharpe, Sortino, Calmar ratios
- Beta, sector/factor exposures
- Stress tests (2008 GFC, 2020 COVID, 2022 rate shock)

### rebalance
Suggest rebalancing trades to hit target allocation with tax and cost awareness.

## MCP Tools Used

- `mcp__fincept-terminal__portfolio_optimize` — run optimization
- `mcp__fincept-terminal__portfolio_risk` — compute risk metrics
- `mcp__fincept-terminal__quantlib_risk` — QuantLib VaR and CVaR
- `mcp__fincept-terminal__watchlist` — current holdings
