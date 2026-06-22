---
name: fincept-trade
description: Execute or simulate trades via Fincept Terminal's 16 broker integrations
usage: /fincept-trade <symbol> <buy|sell> [--qty N] [--broker alpaca] [--paper]
---

# Fincept Trade Skill

Place or simulate trades via Fincept Terminal. Runs the full analyst → quant → trader pipeline before any live execution.

## Usage

```
/fincept-trade AAPL buy --qty 10 --paper
/fincept-trade BTC sell --qty 0.5 --broker kraken
/fincept-trade MSFT buy --qty 100 --broker alpaca
```

## Pipeline

1. `fincept-analyst` — research and thesis validation
2. `fincept-quant` — position sizing, VaR, stop-loss calculation
3. `fincept-trader` — order execution (paper or live)

Live trades require quant risk approval (stop-loss mandatory).

## Supported Brokers

`alpaca` · `ibkr` · `tradier` · `saxo` · `zerodha` · `angelone` · `upstox` · `fyers` · `dhan` · `groww` · `kotak` · `iifl` · `5paisa` · `aliceblue` · `shoonya` · `motilal` · `kraken` · `hyperliquid`

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--qty` | 1 | Number of shares/units |
| `--broker` | alpaca | Broker to route through |
| `--paper` | false | Use paper trading engine |
| `--stop` | quant-calculated | Stop-loss price override |
| `--limit` | market | Limit price (market order if omitted) |
