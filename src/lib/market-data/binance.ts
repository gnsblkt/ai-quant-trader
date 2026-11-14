export type BinanceCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export function parseBinanceKlines(payload: unknown): BinanceCandle[] {
  if (!Array.isArray(payload)) throw new Error("Market-data provider returned an invalid response.");
  const candles = payload.map((row): BinanceCandle => {
    if (!Array.isArray(row) || row.length < 5) throw new Error("Market-data provider returned a malformed candle.");
    const time = Math.floor(Number(row[0]) / 1000);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    if (
      ![time, open, high, low, close].every(Number.isFinite) ||
      time <= 0 || open <= 0 || high <= 0 || low <= 0 || close <= 0 ||
      high < Math.max(open, close, low) ||
      low > Math.min(open, close, high)
    ) {
      throw new Error("Market-data provider returned an invalid OHLC candle.");
    }
    return { time, open, high, low, close };
  });
  candles.sort((a, b) => a.time - b.time);
  const unique = candles.filter((item, index) => index === 0 || item.time !== candles[index - 1].time);
  if (!unique.length) throw new Error("No historical candles were returned.");
  return unique;
}
