import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CryptoCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type CacheEntry = {
  data: CryptoCandle[];
  fetchedAt: number;
};

const SYMBOLS = new Set(["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"]);
const INTERVAL_TTLS: Record<string, number> = {
  "1m": 15_000,
  "5m": 30_000,
  "15m": 60_000,
  "30m": 60_000,
  "1h": 5 * 60_000,
  "4h": 10 * 60_000,
  "1d": 30 * 60_000,
  "1w": 60 * 60_000,
};
const cache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 40;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function parseKlines(payload: unknown): CryptoCandle[] {
  if (!Array.isArray(payload)) throw new Error("Market-data provider returned an invalid response.");
  const candles = payload.map((row): CryptoCandle => {
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

function cacheSet(key: string, entry: CacheEntry) {
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, entry);
}

function response(
  symbol: string,
  interval: string,
  limit: number,
  entry: CacheEntry,
  cached: boolean,
  stale = false,
) {
  return NextResponse.json({
    symbol,
    interval,
    limit,
    source: "Binance public historical market data",
    timeZone: "UTC",
    data: entry.data,
    fetchedAt: entry.fetchedAt,
    cached,
    ...(stale ? { stale: true } : {}),
  }, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = (params.get("symbol") || "BTCUSDT").toUpperCase();
  const interval = params.get("interval") || "1h";
  const rawLimit = Number(params.get("limit") || 500);
  const limit = Number.isInteger(rawLimit) ? Math.min(1000, Math.max(50, rawLimit)) : 500;

  if (!SYMBOLS.has(symbol)) {
    return fail("Unsupported symbol. Choose BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT or XRPUSDT.", 400);
  }
  if (!(interval in INTERVAL_TTLS)) {
    return fail("Unsupported interval. Choose 1m, 5m, 15m, 30m, 1h, 4h, 1d or 1w.", 400);
  }

  const cacheKey = `${symbol}:${interval}:${limit}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.fetchedAt < INTERVAL_TTLS[interval]) {
    return response(symbol, interval, limit, cached, true);
  }

  const url = new URL("https://data-api.binance.vision/api/v3/klines");
  url.search = new URLSearchParams({ symbol, interval, limit: String(limit) }).toString();

  try {
    const upstream = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (!upstream.ok) {
      if (cached) return response(symbol, interval, limit, cached, true, true);
      return fail("Historical market-data provider is temporarily unavailable.", 502);
    }

    const payload = await upstream.json();
    if (!Array.isArray(payload)) {
      if (cached) return response(symbol, interval, limit, cached, true, true);
      return fail("Historical market-data provider returned an unexpected response.", 502);
    }

    const entry = { data: parseKlines(payload), fetchedAt: now };
    cacheSet(cacheKey, entry);
    return response(symbol, interval, limit, entry, false);
  } catch (error) {
    console.error("Crypto historical data request failed:", error instanceof Error ? error.message : "Unknown error");
    if (cached) return response(symbol, interval, limit, cached, true, true);
    return fail("Unable to retrieve historical candles. Please retry shortly.", 502);
  }
}
