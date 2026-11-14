"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "../../../lib/backtest";
import TradeLevelsOverlay, { type TradeLevel } from "./TradeLevelsOverlay";

type Props = {
  candles: Candle[];
  levels?: TradeLevel[];
  onLevelChange?: (id: string, price: number) => void;
  height?: number;
  pricePrecision?: number;
  tickSize?: number;
};

export default function TradingChart({
  candles,
  levels = [],
  onLevelChange = () => undefined,
  height = 360,
  pricePrecision = 5,
  tickSize,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [series, setSeries] = useState<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const instance = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "#0b1220" },
        textColor: "#9caec4",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: { borderColor: "#334155", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "#64748b" }, horzLine: { color: "#64748b" } },
    });
    const candleSeries = instance.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#f87171",
      borderUpColor: "#22c55e",
      borderDownColor: "#f87171",
      wickUpColor: "#22c55e",
      wickDownColor: "#f87171",
    });
    setChart(instance);
    setSeries(candleSeries);
    return () => {
      setChart(null);
      setSeries(null);
      instance.remove();
    };
  }, []);

  useEffect(() => {
    if (!series) return;
    const data: CandlestickData<UTCTimestamp>[] = candles
      .filter((candle) => [candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
      .map((candle) => ({
        time: Math.floor(candle.time / 1000) as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));
    series.setData(data);
    chart?.timeScale().fitContent();
  }, [candles, chart, series]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-[#0b1220]" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      <TradeLevelsOverlay
        chart={chart}
        series={series}
        containerRef={containerRef}
        levels={levels}
        onLevelChange={onLevelChange}
        pricePrecision={pricePrecision}
        tickSize={tickSize}
      />
    </div>
  );
}
