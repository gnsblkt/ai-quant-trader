import { describe, expect, it } from "vitest";
import { parseKlines } from "../app/api/data/crypto/route";

describe("parseKlines", () => {
  it("converts Binance kline arrays to sorted Unix-second OHLC candles", () => {
    const rows = [
      [1_700_000_060_000, "101", "105", "99", "103", "10"],
      [1_700_000_000_000, "100", "104", "98", "102", "12"],
    ];
    expect(parseKlines(rows)).toEqual([
      { time: 1_700_000_000, open: 100, high: 104, low: 98, close: 102 },
      { time: 1_700_000_060, open: 101, high: 105, low: 99, close: 103 },
    ]);
  });

  it("removes duplicate open timestamps", () => {
    const row = [1_700_000_000_000, "100", "104", "98", "102"];
    expect(parseKlines([row, row])).toHaveLength(1);
  });

  it("rejects malformed or inconsistent OHLC data", () => {
    expect(() => parseKlines({ error: "bad response" })).toThrow(/invalid response/i);
    expect(() => parseKlines([[1_700_000_000_000, "100", "99", "98", "102"]])).toThrow(/invalid OHLC/i);
  });
});
