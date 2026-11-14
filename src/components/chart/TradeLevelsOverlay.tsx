"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Coordinate, IChartApi, ISeriesApi } from "lightweight-charts";

export type TradeLevel = {
  id: string;
  label: string;
  price: number;
  color: string;
};

type Props = {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  containerRef: RefObject<HTMLDivElement | null>;
  levels: TradeLevel[];
  onLevelChange: (id: string, price: number) => void;
  disabled?: boolean;
  pricePrecision?: number;
  tickSize?: number;
};

export default function TradeLevelsOverlay({
  chart,
  series,
  containerRef,
  levels,
  onLevelChange,
  disabled = false,
  pricePrecision = 5,
  tickSize,
}: Props) {
  const dragging = useRef<string | null>(null);
  const latestPrice = useRef<number | null>(null);
  const latestLevels = useRef(levels);
  const onChangeRef = useRef(onLevelChange);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    latestLevels.current = levels;
    onChangeRef.current = onLevelChange;
  }, [levels, onLevelChange]);

  const sync = useCallback(() => {
    const container = containerRef.current;
    if (!container || !series) return;
    for (const level of latestLevels.current) {
      const element = container.querySelector<HTMLElement>(`[data-level-id="${CSS.escape(level.id)}"]`);
      if (!element) continue;
      const coordinate = series.priceToCoordinate(level.price);
      element.style.display = coordinate === null ? "none" : "flex";
      if (coordinate !== null) element.style.transform = `translateY(${coordinate}px)`;
    }
  }, [containerRef, series]);

  const scheduleSync = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      sync();
    });
  }, [sync]);

  useEffect(() => {
    if (!chart || !series) return;
    chart.timeScale().subscribeVisibleTimeRangeChange(scheduleSync);
    chart.subscribeCrosshairMove(scheduleSync);
    const observer = containerRef.current ? new ResizeObserver(scheduleSync) : null;
    if (containerRef.current && observer) observer.observe(containerRef.current);
    scheduleSync();
    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(scheduleSync);
      chart.unsubscribeCrosshairMove(scheduleSync);
      observer?.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [chart, series, containerRef, scheduleSync]);

  useEffect(() => {
    scheduleSync();
  }, [levels, scheduleSync]);

  const updateFromPointer = (id: string, clientY: number) => {
    const container = containerRef.current;
    if (!container || !series) return;
    const rect = container.getBoundingClientRect();
    const localY = clientY - rect.top;
    const price = series.coordinateToPrice(localY as Coordinate);
    if (price === null || !Number.isFinite(price) || price <= 0) return;
    const snapped = tickSize && tickSize > 0 ? Math.round(price / tickSize) * tickSize : price;
    latestPrice.current = snapped;
    const element = container.querySelector<HTMLElement>(`[data-level-id="${CSS.escape(id)}"]`);
    if (element) {
      const coordinate = series.priceToCoordinate(snapped);
      if (coordinate !== null) element.style.transform = `translateY(${coordinate}px)`;
      const value = element.querySelector<HTMLElement>("[data-price]");
      if (value) value.textContent = snapped.toFixed(pricePrecision);
    }
    onChangeRef.current(id, snapped);
  };

  const onPointerDown = (id: string) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    dragging.current = id;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    updateFromPointer(dragging.current, event.clientY);
  };

  const onPointerUp = () => {
    dragging.current = null;
    latestPrice.current = null;
    scheduleSync();
  };

  const onKeyDown = (id: string, current: number) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = tickSize && tickSize > 0 ? tickSize : Math.pow(10, -pricePrecision);
    onChangeRef.current(id, current + (event.key === "ArrowUp" ? step : -step));
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-label="Draggable trade levels">
      {levels.map((level) => (
        <div
          key={level.id}
          data-level-id={level.id}
          role="slider"
          aria-label={level.label}
          aria-valuenow={level.price}
          aria-valuemin={0}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={onPointerDown(level.id)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown(level.id, level.price)}
          className="pointer-events-auto absolute left-0 right-0 flex h-0 items-center"
          style={{ touchAction: "none", cursor: disabled ? "default" : "ns-resize" }}
        >
          <div className="w-full border-t border-dashed" style={{ borderColor: level.color }} />
          <span
            className="absolute right-2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-semibold shadow-lg"
            style={{ background: level.color, color: "#08111c" }}
          >
            {level.label} · <span data-price>{level.price.toFixed(pricePrecision)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
