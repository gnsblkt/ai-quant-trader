import { describe, expect, it } from "vitest";
import { engineTick } from "../src/lib/trading/engine";
import type { ActivePosition, MarketCandle } from "../src/types/trading";

const basePosition = (overrides: Partial<ActivePosition> = {}): ActivePosition => ({
  id: "position-1",
  symbol: "EURUSD",
  type: "LONG",
  entryPrice: 1.1,
  entryTime: 100,
  initialSize: 100,
  currentSize: 100,
  stopLoss: 1.09,
  targets: [
    { id: "tp1", price: 1.11, sizePercentage: 50, executed: false, executedAtTime: null },
    { id: "tp2", price: 1.12, sizePercentage: 50, executed: false, executedAtTime: null },
  ],
  status: "OPEN",
  ...overrides,
});

const candle = (overrides: Partial<MarketCandle> = {}): MarketCandle => ({
  time: 200,
  open: 1.1,
  high: 1.105,
  low: 1.095,
  close: 1.102,
  ...overrides,
});

describe("engineTick", () => {
  it("partially closes at each target and closes the whole position", () => {
    const result = engineTick(basePosition(), candle({ high: 1.125 }), { feeRate: 0 });
    expect(result.executions).toHaveLength(2);
    expect(result.executions.map((item) => item.size)).toEqual([50, 50]);
    expect(result.position.currentSize).toBe(0);
    expect(result.position.status).toBe("CLOSED");
  });

  it("uses stop-first when a candle crosses both stop and target", () => {
    const result = engineTick(basePosition(), candle({ high: 1.12, low: 1.08 }), { feeRate: 0 });
    expect(result.executions).toHaveLength(1);
    expect(result.executions[0].reason).toBe("STOP_LOSS");
    expect(result.position.currentSize).toBe(0);
  });

  it("fills a stop at the adverse opening gap", () => {
    const result = engineTick(basePosition(), candle({ open: 1.08, high: 1.1, low: 1.075, close: 1.085 }), { feeRate: 0 });
    expect(result.executions[0].executionPrice).toBe(1.08);
  });

  it("moves the stop to break-even after the first target", () => {
    const result = engineTick(basePosition(), candle({ high: 1.115 }), { feeRate: 0, moveStopToBreakEven: true });
    expect(result.position.currentSize).toBe(50);
    expect(result.position.status).toBe("PARTIAL");
    expect(result.position.stopLoss).toBe(1.1);
  });

  it("does not process the same candle twice", () => {
    const first = engineTick(basePosition(), candle({ high: 1.115 }), { feeRate: 0 });
    const second = engineTick(first.position, candle({ high: 1.115 }), { feeRate: 0 });
    expect(second.duplicateCandle).toBe(true);
    expect(second.executions).toHaveLength(0);
  });

  it("rejects target allocations above 100 percent", () => {
    const invalid = basePosition({
      targets: [
        { id: "a", price: 1.11, sizePercentage: 70, executed: false, executedAtTime: null },
        { id: "b", price: 1.12, sizePercentage: 40, executed: false, executedAtTime: null },
      ],
    });
    expect(() => engineTick(invalid, candle())).toThrow(/cannot exceed 100/);
  });
});
