"use client";

import { useEffect, useRef, useState } from "react";

export type DatasetStats = {
  mean: number;
  standardDeviation: number;
  minimum: number;
  maximum: number;
  count: number;
  histogram: number[];
};

const emptyStats: DatasetStats = {
  mean: 0, standardDeviation: 0, minimum: 0, maximum: 0, count: 0, histogram: [],
};

/** Computes descriptive statistics off the UI thread. */
export function useDatasetStats(rows: ReadonlyArray<{ close: number }>, bins = 18) {
  const workerRef = useRef<Worker | null>(null);
  const [stats, setStats] = useState<DatasetStats>(emptyStats);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/dataStats.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<DatasetStats>) => setStats(event.data);
    worker.onerror = () => setStats(emptyStats);
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    workerRef.current?.postMessage({
      values: rows.map((row) => row.close),
      bins,
    });
  }, [rows, bins]);

  return stats;
}
