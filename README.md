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
