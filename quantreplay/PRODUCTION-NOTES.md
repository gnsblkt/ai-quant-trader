# QuantReplay production notes

## Scope
The application is an educational historical-data and paper-simulation product. It must not add broker credentials, exchange account connections, deposits, withdrawals, leverage, or live order execution.

## Forex data
The Next.js API route is `/api/data/forex`. It reads `ALPHA_VANTAGE_API_KEY` only on the server and never returns the key to the browser.

Alpha Vantage documents `FX_INTRADAY` as a premium API function. Confirm that the account has this endpoint entitlement before expecting EURUSD 60-minute data to load. Configure the key in Vercel Project Settings → Environment Variables for Production, Preview, and Development. Do not commit the actual key or put it in a `NEXT_PUBLIC_*` variable.

The route uses a process-local memory cache. On serverless deployments, instances do not share memory; this is a best-effort per-instance cache, not a global provider-quota limiter. Add a shared Redis/Upstash cache and request budget before high-volume commercial use.

## Execution assumptions
- OHLC candles do not reveal the path taken inside a candle.
- If stop-loss and targets are both crossed in one candle, stop-loss is assumed first.
- Gap-through-stop fills use the candle open when that is worse than the stop.
- Target slices are percentages of the original position.
- Fees are a simplified linear price-times-size model; FX pip value, contract size, spread, slippage, swaps, financing, and quote-currency conversion are not modelled.

## Verification
Run `npm run typecheck`, `npm run test`, and `npm run build` before release. Browser-level interaction testing is still required for pointer dragging and mobile chart resizing.
