---
name: fincept-quant
description: Run QuantLib pricing and risk models via Fincept Terminal's 18-module quant suite
usage: /fincept-quant <model> [--params key=val ...]
---

# Fincept Quant Skill

Access Fincept Terminal's 18-module QuantLib suite for derivatives pricing, risk modeling, and quantitative analysis.

## Usage

```
/fincept-quant black-scholes --S 150 --K 155 --T 0.25 --r 0.05 --sigma 0.2
/fincept-quant var --portfolio current --confidence 0.99 --horizon 10d
/fincept-quant heston-calibrate --ticker AAPL
/fincept-quant bond-duration --cusip 912828ZQ2
```

## Models

### Options Pricing
- `black-scholes` — European option pricing with Greeks
- `binomial` — American option (Cox-Ross-Rubinstein)
- `monte-carlo` — Path-dependent derivatives
- `barrier` — Barrier and binary options
- `asian` — Asian option averaging

### Fixed Income
- `bond-price` — Clean/dirty price with yield
- `bond-duration` — Macaulay and modified duration
- `yield-curve` — Bootstrap from market instruments
- `swap-price` — Vanilla interest rate swap

### Risk
- `var` — Value at Risk (historical/parametric/MC)
- `cvar` — Conditional VaR / Expected Shortfall
- `stress-test` — Historical scenario P&L

### Volatility
- `vol-surface` — Build and display vol surface
- `sabr-calibrate` — Calibrate SABR parameters
- `heston-calibrate` — Calibrate Heston stochastic vol

### Statistical
- `cointegration` — Johansen pairs trading test
- `hurst` — Hurst exponent (mean-reversion / trend)
- `adf` — Augmented Dickey-Fuller stationarity test

## MCP Tools Used

- `mcp__fincept-terminal__quantlib_price` — model pricing
- `mcp__fincept-terminal__quantlib_risk` — risk metrics
- `mcp__fincept-terminal__surface_analytics` — vol surfaces
- `mcp__fincept-terminal__quant_lab` — interactive quant lab
- `mcp__fincept-terminal__python_exec` — custom Python models
