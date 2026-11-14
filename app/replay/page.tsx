"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, ChevronRight, LoaderCircle, Play, RefreshCw, ShieldCheck } from "lucide-react";
import TradingChart from "../../src/components/chart/TradingChart";
import { engineTick } from "../../src/lib/trading/engine";
import type { ActivePosition, MarketCandle, TradeExecution, TradeTarget } from "../../src/types/trading";
import type { Candle } from "../../lib/backtest";

const fmt = (value: number, digits = 5) => Number.isFinite(value) ? value.toFixed(digits) : "—";
const cash = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`;

type ForexResponse = {
  data: MarketCandle[];
  pair: string;
  interval: string;
  timeZone: string;
  cached: boolean;
  stale?: boolean;
};

export default function ReplayPage() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("No dataset loaded");
  const [position, setPosition] = useState<ActivePosition | null>(null);
  const [executions, setExecutions] = useState<TradeExecution[]>([]);
  const [moveToBreakEven, setMoveToBreakEven] = useState(true);
  const [entryPrice, setEntryPrice] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [target1, setTarget1] = useState(0);
  const [target2, setTarget2] = useState(0);
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [stepIndex, setStepIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/data/forex?pair=EURUSD&interval=60min", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load forex history.");
      const data = (body as ForexResponse).data;
      if (!Array.isArray(data) || data.length < 3) throw new Error("Provider returned too few candles.");
      const mapped: Candle[] = data.map((candle) => ({ ...candle, time: candle.time * 1000, volume: 0 }));
      setCandles(mapped);
      setStepIndex(Math.max(0, mapped.length - 20));
      const latest = mapped[mapped.length - 1].close;
      setEntryPrice(latest);
      setStopLoss(latest * 0.995);
      setTarget1(latest * 1.005);
      setTarget2(latest * 1.01);
      setPosition(null);
      setExecutions([]);
      setStatus(`${body.pair} · ${body.interval} · ${mapped.length} candles · ${body.timeZone}${body.stale ? " · cached fallback" : ""}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Forex data request failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleCandles = useMemo(() => candles.slice(0, Math.max(1, stepIndex + 1)), [candles, stepIndex]);
  const lastCandle = visibleCandles[visibleCandles.length - 1];
  const levels = useMemo(() => {
    if (!lastCandle) return [];
    return [
      { id: "stop", label: "SL", price: stopLoss, color: "#fb7185" },
      { id: "target-1", label: "TP1", price: target1, color: "#34d399" },
      { id: "target-2", label: "TP2", price: target2, color: "#60a5fa" },
    ].filter((level) => Number.isFinite(level.price) && level.price > 0);
  }, [lastCandle, stopLoss, target1, target2]);

  const handleLevelChange = (id: string, price: number) => {
    if (id === "stop") setStopLoss(price);
    if (id === "target-1") setTarget1(price);
    if (id === "target-2") setTarget2(price);
  };

  const openPosition = () => {
    if (!lastCandle) return;
    const isLong = side === "LONG";
    if (isLong ? !(stopLoss < entryPrice && target1 > entryPrice && target2 > target1) : !(stopLoss > entryPrice && target1 < entryPrice && target2 < target1)) {
      setError("Check entry, stop and target order for the selected direction.");
      return;
    }
    const next: ActivePosition = {
      id: `paper-${Date.now()}`,
      symbol: "EURUSD",
      type: side,
      entryPrice,
      entryTime: lastCandle.time,
      initialSize: 10_000,
      currentSize: 10_000,
      stopLoss,
      targets: [
        { id: "target-1", price: target1, sizePercentage: 50, executed: false, executedAtTime: null },
        { id: "target-2", price: target2, sizePercentage: 50, executed: false, executedAtTime: null },
      ],
      status: "OPEN",
    };
    setPosition(next);
    setExecutions([]);
    setError("");
  };

  const advance = () => {
    if (!position || !candles.length || stepIndex >= candles.length - 1) return;
    const nextIndex = stepIndex + 1;
    const source = candles[nextIndex];
    const bar: MarketCandle = { time: source.time / 1000, open: source.open, high: source.high, low: source.low, close: source.close };
    const result = engineTick(position, bar, { feeRate: 0.00004, moveStopToBreakEven });
    setPosition(result.position);
    setExecutions((current) => [...result.executions, ...current]);
    setStepIndex(nextIndex);
  };

  const totalRealized = executions.reduce((sum, item) => sum + item.netPnL, 0);
  const activeTargets: TradeTarget[] = position?.targets ?? [];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-slate-100 md:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="mb-2 inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200"><ArrowLeft size={14} /> Back to QuantLab</Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Activity className="text-cyan-300" /> Multi-target Replay Studio</h1>
            <p className="mt-1 text-xs text-slate-400">EUR/USD hourly candles · draggable paper risk levels · deterministic candle-by-candle simulation</p>
          </div>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">
            {loading ? <LoaderCircle className="animate-spin" size={15} /> : <RefreshCw size={15} />} Refresh data
          </button>
        </header>

        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
          <ShieldCheck size={17} className="shrink-0" />
          <p>Educational paper simulation only. No brokerage connection, real orders, deposits, leverage or profit claims. OHLC bars cannot reveal the exact intrabar price path; stop-loss is assumed first if stop and targets are touched in the same candle.</p>
        </div>

        {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-semibold">EUR/USD · 60 minutes</h2><p className="mt-1 text-xs text-slate-400">{status}</p></div>
              <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-400">{visibleCandles.length} / {candles.length} bars revealed</span>
            </div>
            {candles.length ? <TradingChart candles={visibleCandles} levels={position?.status === "CLOSED" ? [] : levels} onLevelChange={handleLevelChange} /> : <div className="grid h-[360px] place-items-center text-sm text-slate-400">{loading ? "Loading historical candles…" : "No forex data loaded."}</div>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
              <p className="text-xs text-slate-400">Replay cursor: {lastCandle ? new Date(lastCandle.time).toLocaleString() : "—"}</p>
              <button onClick={advance} disabled={!position || position.status === "CLOSED" || stepIndex >= candles.length - 1} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"><ChevronRight size={15} /> Advance one candle</button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 font-semibold">Paper position setup</h2>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button onClick={() => setSide("LONG")} className={`rounded-lg border px-3 py-2 text-sm ${side === "LONG" ? "border-emerald-400 bg-emerald-400/10 text-emerald-300" : "border-slate-700"}`}>Long</button>
                <button onClick={() => setSide("SHORT")} className={`rounded-lg border px-3 py-2 text-sm ${side === "SHORT" ? "border-rose-400 bg-rose-400/10 text-rose-300" : "border-slate-700"}`}>Short</button>
              </div>
              {[
                ["Entry", entryPrice, setEntryPrice],
                ["Stop loss", stopLoss, setStopLoss],
                ["Target 1", target1, setTarget1],
                ["Target 2", target2, setTarget2],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="mb-3 block text-xs text-slate-400">
                  {label as string}
                  <input type="number" step="0.00001" value={value as number} onChange={(event) => (setter as (value: number) => void)(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
              ))}
              <label className="mb-3 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={moveToBreakEven} onChange={(event) => setMoveToBreakEven(event.target.checked)} /> Move stop to entry after TP1</label>
              <button onClick={openPosition} disabled={!lastCandle || position?.status !== "CLOSED" && position !== null} className="w-full rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"><Play size={14} className="mr-2 inline" /> Start paper replay</button>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Two targets close 50% of the original simulated position each. Prices can be dragged directly on the chart or edited here.</p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-2 font-semibold">Position status</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-500">Status</span><b className="mt-1 block">{position?.status ?? "Not started"}</b></div>
                <div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-500">Remaining size</span><b className="mt-1 block">{fmt(position?.currentSize ?? 0, 0)}</b></div>
                <div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-500">Realized P/L</span><b className="mt-1 block">{cash(totalRealized)}</b></div>
                <div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-500">Executions</span><b className="mt-1 block">{executions.length}</b></div>
              </div>
              {position && <div className="mt-3 space-y-1 text-xs text-slate-400">{activeTargets.map((target) => <p key={target.id}>{target.id}: {target.executed ? `filled at candle ${new Date((target.executedAtTime ?? 0) * 1000).toLocaleString()}` : "pending"}</p>)}</div>}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-2 font-semibold">Execution log</h2>
              {executions.length ? <div className="max-h-64 space-y-2 overflow-auto">{executions.map((item) => <div key={item.id} className="rounded-lg bg-slate-950 p-2 text-xs"><div className="flex justify-between"><b>{item.reason.replace("_", " ")}</b><span>{cash(item.netPnL)}</span></div><p className="mt-1 text-slate-500">{fmt(item.executionPrice)} · size {fmt(item.size, 0)} · fees {cash(item.fees)}</p></div>)}</div> : <p className="text-xs text-slate-500">No simulated fills yet.</p>}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
