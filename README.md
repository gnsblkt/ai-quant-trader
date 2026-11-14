# QuantLab — AI Quant Trader (paper simulation)

A learning-first market dashboard. It uses public market data and a local simulated portfolio only.

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Safety and scope
- Simulation only: no exchange accounts, API keys, deposits, withdrawals, leverage, or real orders.
- Indicators are educational descriptions, not buy/sell recommendations or predictions.
- Market data comes from Binance's public market-data endpoint. If unavailable, the UI reports that instead of inventing prices.
- Paper trades are hypothetical and do not predict real-world outcomes.

## Deploy
Import this repository into Vercel. Framework preset: Next.js. No environment variables are required for the starter.


## Multi-target Replay Studio
Open `/replay` for the EURUSD 60-minute historical paper-replay workspace. It includes draggable stop/target overlays and deterministic partial-exit simulation.

## Development checks
```bash
npm install
npm run typecheck
npm test
npm run build
```

Configure `ALPHA_VANTAGE_API_KEY` as a server-side environment variable before using the Forex route. Alpha Vantage lists `FX_INTRADAY` as a premium function; the route reports a configuration/provider error rather than substituting synthetic data when unavailable. See [QuantReplay production notes](quantreplay/PRODUCTION-NOTES.md).
