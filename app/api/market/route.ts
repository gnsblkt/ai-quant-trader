import { NextResponse } from "next/server";
const allowed = new Set(["BTCUSDT","ETHUSDT","SOLUSDT"]);
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
  if (!allowed.has(symbol)) return NextResponse.json({ error: "Unsupported symbol" }, { status: 400 });
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=5m&limit=72`, { next: { revalidate: 20 } });
    if (!response.ok) throw new Error("Market data provider unavailable");
    const raw: unknown[][] = await response.json();
    const candles = raw.map(k => ({ time: Number(k[0]), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) }));
    return NextResponse.json({ symbol, candles, source: "Binance public market data", fetchedAt: Date.now() });
  } catch {
    return NextResponse.json({ error: "Live public market data is temporarily unavailable. No prices have been fabricated." }, { status: 503 });
  }
}
