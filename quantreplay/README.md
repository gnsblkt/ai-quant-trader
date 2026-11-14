# QuantReplay

A responsive browser-based historical market replay and paper-trading MVP.

## Features
- Public historical spot candles for BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT and XRPUSDT from Binance market-data endpoints.
- 1m, 5m, 15m, 30m, 1h, 4h, 1d and 1w chart intervals.
- Candle-by-candle replay, play/pause, speed control, stepping and replay-position slider.
- Simulated long/short positions with entry, stop-loss, take-profit, risk-based quantity and fee assumptions.
- Conservative intrabar execution: when a candle touches both stop and target, stop-loss is assumed first; opening gaps use the candle open.
- EMA 20/50 overlays and a simplified long-only EMA crossover test.
- Trade history, basic metrics, CSV OHLC import and browser-local session saving.
- Responsive desktop and mobile layout.

## Data boundaries
Crypto candles come from Binance public market-data endpoints. No Forex feed is bundled. Import your own licensed Forex OHLC CSV with timestamp/date, open, high, low, close and optional volume columns. The simulator does not infer broker contract sizes, pip values, quote-currency conversions, spreads, swaps or slippage. Validate instrument specifications separately.

Sessions are saved in the current browser only. This MVP does not provide accounts, cloud sync, multi-target exits, a complete visual strategy builder, walk-forward testing or Monte Carlo analysis. The EMA strategy example is intentionally simplified and its assumptions are shown in the interface.

## Deployment
Configure a separate Vercel project using this folder as its Root Directory. It is a static site and requires no build step.

Educational historical simulation only. No live orders, broker integration, investment advice or guarantee of future results.
