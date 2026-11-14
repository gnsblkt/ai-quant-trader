# QuantReplay — Historical Research & Paper Replay

A learning-first historical market research application. It uses public market data and a local simulated portfolio only.

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Historical market data
- The replay workspace at `/replay` loads BTCUSDT hourly candles from Binance's public market-data API.
- Supported symbols: BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT and XRPUSDT.
- Supported intervals: 1m, 5m, 15m, 30m, 1h, 4h, 1d and 1w.
- Candle responses are validated, normalized to Unix seconds, and cached in-process with stale-cache fallback.
- No Alpha Vantage key or exchange credentials are required for the crypto replay route.

## Multi-target Replay Studio
Open `/replay` for candle-by-candle BTC/USDT paper replay. It includes draggable stop-loss and take-profit levels, two partial exits, optional break-even stop movement, gap-aware simulated fills, fees, and an execution log.

## Simulation scope
- Educational simulation only: no exchange account integration, live orders, deposits, withdrawals, or leverage.
- OHLC data cannot reveal the exact intrabar path. If a candle touches both stop and target levels, the engine applies the conservative stop-first assumption.
- Fees are a simplified configurable model. Spread, slippage, funding, contract specifications, and exchange-specific execution are not modeled.
- Simulated results are not predictions of future performance.

## Development checks
```bash
npm install
npm run typecheck
npm test
npm run build
```

The repository currently has no committed npm lockfile, so CI intentionally uses `npm install` and does not enable setup-node's npm cache (which requires a lockfile). When a generated `package-lock.json` is committed, change CI to `npm ci` and enable npm caching.
