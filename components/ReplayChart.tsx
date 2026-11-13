"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

export type SampleOHLC = {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type ReplayChartProps = {
  data: SampleOHLC[];
  currentIndex: number;
  title?: string;
};

const toCandle = (row: SampleOHLC) => ({
  time: (Date.UTC(2024, 0, 1) / 1000 + row.t * 86400) as UTCTimestamp,
  open: row.open,
  high: row.high,
  low: row.low,
  close: row.close,
});

/**
 * Candlestick view for a fictional sample series.
 * The chart only reveals observations up to currentIndex; it has no execution UI.
 */
export default function ReplayChart({
  data,
  currentIndex,
  title = "Synthetic OHLC series",
}: ReplayChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastIndexRef = useRef(-1);

  useEffect(() => {
    if (!hostRef.current) return;

    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#111b27" },
        textColor: "#91a2b5",
        fontFamily: "DM Sans, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#233344" },
        horzLines: { color: "#233344" },
      },
      crosshair: {
        vertLine: { color: "#6b8e88", labelBackgroundColor: "#29443f" },
        horzLine: { color: "#6b8e88", labelBackgroundColor: "#29443f" },
      },
      rightPriceScale: { borderColor: "#344659", scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: {
        borderColor: "#344659",
        timeVisible: false,
        secondsVisible: false,
        rightOffset: 3,
        barSpacing: 8,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#58c7a8",
      downColor: "#df8d83",
      borderUpColor: "#58c7a8",
      borderDownColor: "#df8d83",
      wickUpColor: "#58c7a8",
      wickDownColor: "#df8d83",
      priceLineVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = candles;
    const initial = data.slice(0, Math.min(data.length, currentIndex + 1));
    candles.setData(initial.map(toCandle));
    lastIndexRef.current = initial.length - 1;
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      lastIndexRef.current = -1;
    };
    // Recreate only when the selected dataset changes.
  }, [data]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || data.length === 0) return;

    const safeIndex = Math.max(0, Math.min(data.length - 1, currentIndex));
    if (safeIndex === lastIndexRef.current + 1) {
      series.update(toCandle(data[safeIndex]));
    } else if (safeIndex !== lastIndexRef.current) {
      series.setData(data.slice(0, safeIndex + 1).map(toCandle));
    }
    lastIndexRef.current = safeIndex;
  }, [currentIndex, data]);

  const current = data[Math.max(0, Math.min(data.length - 1, currentIndex))];

  return (
    <section className="replay-chart-wrap" aria-label={title}>
      <div className="replay-chart-heading">
        <span>{title}</span>
        {current && (
          <span className="replay-chart-values">
            O {current.open.toFixed(2)} · H {current.high.toFixed(2)} · L {current.low.toFixed(2)} · C {current.close.toFixed(2)}
          </span>
        )}
      </div>
      <div ref={hostRef} className="replay-chart-canvas" />
      <div className="replay-chart-foot">
        <span>FICTIONAL DATA · OHLC VISUALIZATION</span>
        <span>{Math.min(currentIndex + 1, data.length)} / {data.length} observations revealed</span>
      </div>
    </section>
  );
}
