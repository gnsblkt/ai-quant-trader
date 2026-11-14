# QuantReplay production QA

## Automated checks

GitHub Actions runs these checks on every pull request targeting `main`, every push to `main`, and on manual dispatch:

1. **QuantReplay static QA** — validates the document metadata, critical UI element IDs, expected data-source and simulation-boundary markers, and compiles the inline JavaScript without executing browser-only code.
2. **Next.js typecheck** — runs `tsc --noEmit` against the repository's Next.js application.
3. **Next.js production build** — runs `next build`.

A green workflow is a merge/deployment gate signal, not proof that every interactive browser flow has been tested.

## Manual production smoke test

After deployment, open the production URL on desktop Chrome and Android Chrome:

- [ ] Page loads; refresh and browser navigation work.
- [ ] Select BTCUSDT and ETHUSDT; verify real candles load and the status reports the data source.
- [ ] Switch each supported timeframe; confirm candles and labels update.
- [ ] Play, pause, step backward/forward, jump to last candle, and change replay speed.
- [ ] Place a simulated LONG and SHORT with valid stop-loss and optional take-profit.
- [ ] Confirm stop/target execution, trade history, fees, P&L, and metrics.
- [ ] Verify the documented stop-first rule when one candle spans both stop and target.
- [ ] Close a position manually; refresh and verify browser-local session restoration.
- [ ] Import a valid OHLC CSV and an invalid CSV; verify useful feedback.
- [ ] Test portrait/landscape layouts, touch targets, chart resize, and horizontal overflow.
- [ ] Check browser console and network panel for uncaught errors or leaked secrets.

## Known test boundary

The current QuantReplay artifact is a standalone HTML/JavaScript page, not the Next.js app under `app/`. The automated static check validates its script syntax and required markup, but does not run a real browser, call Binance, simulate candles end-to-end, or verify Vercel production behavior. Those remain manual checks until browser automation and dedicated trading-engine unit tests are added.
