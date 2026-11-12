import { NextResponse } from "next/server";

const allowed = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

async function fetchBinance(baseUrl: string, symbol: string) {
  const url = new URL("/api/v3/klines", baseUrl);
  url.search = new URLSearchParams({
    symbol,
    interval: "5m",
    limit: "72",
  }).toString();

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Provider returned HTTP ${response.status}`);
  }

  const raw: unknown = await response.json();
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Provider returned an empty or invalid candle list");
  }

  const candles: Candle[] = raw.map((item: unknown) => {
    if (!Array.isArray(item) || item.length < 6) {
      throw new Error("Provider returned an invalid candle");
    }
    const candle = {
      time: Number(item[0]),
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4]),
      volume: Number(item[5]),
    };
    if (Object.values(candle).some((value) => !Number.isFinite(value))) {
      throw new Error("Provider returned non-numeric candle data");
    }
    return candle;
  });

  return candles;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();

  if (!allowed.has(symbol)) {
    return NextResponse.json({ error: "Unsupported symbol" }, { status: 400 });
  }

  // The data-api host serves public Binance market data and can work in
  // regions where the primary API hostname is unavailable.
  const providers = [
    "https://data-api.binance.vision",
    "https://api.binance.com",
  ];

  for (const provider of providers) {
    try {
      const candles = await fetchBinance(provider, symbol);
      return NextResponse.json(
        {
          symbol,
          candles,
          source: "Binance public market data",
          fetchedAt: Date.now(),
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
          },
        },
      );
    } catch (error) {
      console.error(
        `Market data provider failed (${new URL(provider).host}):`,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  return NextResponse.json(
    {
      error:
        "Live public market data is temporarily unavailable. No prices have been fabricated.",
    },
    { status: 503 },
  );
}
