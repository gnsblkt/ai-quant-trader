import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ForexCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type CacheEntry = {
  data: ForexCandle[];
  timeZone: string;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 32;
const INTERVALS = new Set(["1min", "5min", "15min", "30min", "60min"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Alpha Vantage FX timestamps are wall-clock values in the metadata timezone. */
function zonedDateTimeToUnix(value: string, timeZone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Provider returned an invalid timestamp.");

  const [, y, mo, d, h, mi, s] = match;
  const targetUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let candidate = targetUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]),
    );
    const observedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const delta = observedUtc - targetUtc;
    if (delta === 0) break;
    candidate -= delta;
  }
  return Math.floor(candidate / 1000);
}

function parseCandles(payload: Record<string, unknown>, interval: string) {
  const metadata = payload["Meta Data"] as Record<string, unknown> | undefined;
  const series = payload[`Time Series FX (${interval})`] as Record<string, Record<string, string>> | undefined;
  if (!series || typeof series !== "object") {
    const providerMessage = String(payload.Note || payload.Information || payload["Error Message"] || "");
    throw new Error(providerMessage || "Forex provider returned no time-series data.");
  }

  const rawZone = String(metadata?.["6. Time Zone"] || "UTC");
  let timeZone = rawZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    timeZone = "UTC";
  }

  const candles = Object.entries(series).map(([timestamp, values]) => {
    const candle: ForexCandle = {
      time: zonedDateTimeToUnix(timestamp, timeZone),
      open: Number(values["1. open"]),
      high: Number(values["2. high"]),
      low: Number(values["3. low"]),
      close: Number(values["4. close"]),
    };
    if (
      !Object.values(candle).every(Number.isFinite) ||
      candle.time <= 0 ||
      candle.open <= 0 ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close) ||
      candle.low <= 0
    ) {
      throw new Error("Forex provider returned an invalid OHLC candle.");
    }
    return candle;
  });

  candles.sort((a, b) => a.time - b.time);
  const unique = candles.filter((candle, index) => index === 0 || candle.time !== candles[index - 1].time);
  if (!unique.length) throw new Error("Forex provider returned an empty dataset.");
  return { data: unique, timeZone };
}

function cacheSet(key: string, value: CacheEntry) {
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pair = (params.get("pair") || "EURUSD").toUpperCase();
  const interval = params.get("interval") || "60min";

  if (!/^[A-Z]{6}$/.test(pair)) return jsonError("Pair must contain exactly six currency letters.", 400);
  if (!INTERVALS.has(interval)) return jsonError("Unsupported interval.", 400);

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return jsonError("Forex data is not configured. Add ALPHA_VANTAGE_API_KEY to the server environment.", 503);

  const key = `${pair}:${interval}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      { pair, interval, data: cached.data, timeZone: cached.timeZone, fetchedAt: cached.fetchedAt, cached: true },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.search = new URLSearchParams({
    function: "FX_INTRADAY",
    from_symbol: pair.slice(0, 3),
    to_symbol: pair.slice(3, 6),
    interval,
    outputsize: "full",
    datatype: "json",
    apikey: apiKey,
  }).toString();

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      if (cached) {
        return NextResponse.json(
          { pair, interval, data: cached.data, timeZone: cached.timeZone, fetchedAt: cached.fetchedAt, cached: true, stale: true },
          { headers: { "Cache-Control": "private, max-age=30" } },
        );
      }
      return jsonError("Forex data provider is temporarily unavailable.", 502);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const providerMessage = String(payload.Note || payload.Information || payload["Error Message"] || "");
    if (providerMessage) {
      if (cached) {
        return NextResponse.json(
          { pair, interval, data: cached.data, timeZone: cached.timeZone, fetchedAt: cached.fetchedAt, cached: true, stale: true, warning: "Provider limit reached; showing cached data." },
          { headers: { "Cache-Control": "private, max-age=30" } },
        );
      }
      return jsonError("Forex provider rejected the request. Check API entitlement and request limits.", 429);
    }

    const parsed = parseCandles(payload, interval);
    const entry = { ...parsed, fetchedAt: now };
    cacheSet(key, entry);
    return NextResponse.json(
      { pair, interval, data: entry.data, timeZone: entry.timeZone, fetchedAt: entry.fetchedAt, cached: false },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    console.error("Forex data request failed:", error instanceof Error ? error.message : "Unknown error");
    if (cached) {
      return NextResponse.json(
        { pair, interval, data: cached.data, timeZone: cached.timeZone, fetchedAt: cached.fetchedAt, cached: true, stale: true },
        { headers: { "Cache-Control": "private, max-age=30" } },
      );
    }
    return jsonError("Unable to retrieve forex candles. Please retry later.", 502);
  }
}
