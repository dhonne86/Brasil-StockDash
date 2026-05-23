import React, { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, AreaSeries } from "lightweight-charts";
import { api } from "../lib/api";

const RANGES = [
  { id: "1d", label: "1D" },
  { id: "5d", label: "5D" },
  { id: "1mo", label: "1M" },
  { id: "3mo", label: "3M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: "1A" },
];

const OVERLAYS = [
  { id: "bollinger", label: "Bollinger" },
  { id: "ema9", label: "EMA 9" },
  { id: "ema21", label: "EMA 21" },
  { id: "ema50", label: "EMA 50" },
];

export default function TradingChart({ symbol }) {
  const containerRef = useRef(null);
  const subChartRef = useRef(null);
  const chartRef = useRef(null);
  const subRef = useRef(null);
  const seriesRefs = useRef({});
  const [range, setRange] = useState("3mo");
  const [enabled, setEnabled] = useState({ bollinger: true, ema9: true, ema21: true, ema50: false });
  const [loading, setLoading] = useState(false);
  const [showRSI, setShowRSI] = useState(true);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      localization: { locale: "pt-BR" },
      layout: {
        background: { color: "#0F0F11" },
        textColor: "#a1a1aa",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "#3b82f6", width: 1, style: 2, labelBackgroundColor: "#3b82f6" },
        horzLine: { color: "#3b82f6", width: 1, style: 2, labelBackgroundColor: "#3b82f6" },
      },
      autoSize: true,
    });
    chartRef.current = chart;

    const subChart = createChart(subChartRef.current, {
      localization: { locale: "pt-BR" },
      layout: {
        background: { color: "#0F0F11" },
        textColor: "#a1a1aa",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
    });
    subRef.current = subChart;

    // Sync time scales
    chart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      if (r) subChart.timeScale().setVisibleLogicalRange(r);
    });
    subChart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      if (r) chart.timeScale().setVisibleLogicalRange(r);
    });

    return () => {
      chart.remove();
      subChart.remove();
    };
  }, []);

  // Fetch & render data
  useEffect(() => {
    if (!symbol || !chartRef.current) return;
    let active = true;
    setLoading(true);

    (async () => {
      try {
        const res = await api.get(`/indicators/${symbol}`, { params: { range } });
        if (!active) return;
        const { candles, indicators } = res.data;

        const chart = chartRef.current;
        const sub = subRef.current;

        // Clear previous series
        Object.values(seriesRefs.current).forEach((s) => {
          try {
            if (s._chart === "main") chart.removeSeries(s.ref);
            else sub.removeSeries(s.ref);
          } catch (_) {}
        });
        seriesRefs.current = {};

        // Candles
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#10b981",
          downColor: "#ef4444",
          borderUpColor: "#10b981",
          borderDownColor: "#ef4444",
          wickUpColor: "#10b981",
          wickDownColor: "#ef4444",
        });
        candleSeries.setData(candles);
        seriesRefs.current.candles = { ref: candleSeries, _chart: "main" };

        // Volume histogram on main chart (scaled)
        const volSeries = chart.addSeries(HistogramSeries, {
          color: "#3f3f46",
          priceFormat: { type: "volume" },
          priceScaleId: "vol",
        });
        volSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        volSeries.setData(
          candles.map((c) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
          }))
        );
        seriesRefs.current.volume = { ref: volSeries, _chart: "main" };

        // Overlays
        const overlayData = (arr) =>
          candles.map((c, i) => (arr[i] !== null && arr[i] !== undefined ? { time: c.time, value: arr[i] } : null)).filter(Boolean);

        if (enabled.bollinger) {
          const upper = chart.addSeries(LineSeries, { color: "rgba(59,130,246,0.6)", lineWidth: 1 });
          upper.setData(overlayData(indicators.bollinger.upper));
          const mid = chart.addSeries(LineSeries, { color: "rgba(59,130,246,0.4)", lineWidth: 1, lineStyle: 2 });
          mid.setData(overlayData(indicators.bollinger.middle));
          const lower = chart.addSeries(LineSeries, { color: "rgba(59,130,246,0.6)", lineWidth: 1 });
          lower.setData(overlayData(indicators.bollinger.lower));
          seriesRefs.current.bb_upper = { ref: upper, _chart: "main" };
          seriesRefs.current.bb_mid = { ref: mid, _chart: "main" };
          seriesRefs.current.bb_lower = { ref: lower, _chart: "main" };
        }
        if (enabled.ema9) {
          const s = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1.5 });
          s.setData(overlayData(indicators.ema9));
          seriesRefs.current.ema9 = { ref: s, _chart: "main" };
        }
        if (enabled.ema21) {
          const s = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1.5 });
          s.setData(overlayData(indicators.ema21));
          seriesRefs.current.ema21 = { ref: s, _chart: "main" };
        }
        if (enabled.ema50) {
          const s = chart.addSeries(LineSeries, { color: "#06b6d4", lineWidth: 1.5 });
          s.setData(overlayData(indicators.ema50));
          seriesRefs.current.ema50 = { ref: s, _chart: "main" };
        }

        // Sub chart: RSI or MACD
        if (showRSI) {
          const rsiSeries = sub.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1.5 });
          rsiSeries.setData(overlayData(indicators.rsi));
          // Reference lines 30 / 70
          const ref70 = sub.addSeries(LineSeries, { color: "rgba(239,68,68,0.4)", lineWidth: 1, lineStyle: 2 });
          ref70.setData(candles.map((c) => ({ time: c.time, value: 70 })));
          const ref30 = sub.addSeries(LineSeries, { color: "rgba(16,185,129,0.4)", lineWidth: 1, lineStyle: 2 });
          ref30.setData(candles.map((c) => ({ time: c.time, value: 30 })));
          seriesRefs.current.rsi = { ref: rsiSeries, _chart: "sub" };
          seriesRefs.current.rsi_ref70 = { ref: ref70, _chart: "sub" };
          seriesRefs.current.rsi_ref30 = { ref: ref30, _chart: "sub" };
        } else {
          // MACD
          const macdLine = sub.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1.5 });
          macdLine.setData(overlayData(indicators.macd.macd));
          const sigLine = sub.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1.5 });
          sigLine.setData(overlayData(indicators.macd.signal));
          const histSeries = sub.addSeries(HistogramSeries, { color: "#a1a1aa" });
          histSeries.setData(
            candles
              .map((c, i) => {
                const v = indicators.macd.histogram[i];
                if (v === null || v === undefined) return null;
                return {
                  time: c.time,
                  value: v,
                  color: v >= 0 ? "rgba(16,185,129,0.6)" : "rgba(239,68,68,0.6)",
                };
              })
              .filter(Boolean)
          );
          seriesRefs.current.macd = { ref: macdLine, _chart: "sub" };
          seriesRefs.current.macd_sig = { ref: sigLine, _chart: "sub" };
          seriesRefs.current.macd_hist = { ref: histSeries, _chart: "sub" };
        }

        chart.timeScale().fitContent();
        sub.timeScale().fitContent();
      } catch (e) {
        console.error("chart load failed", e);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line
  }, [symbol, range, enabled, showRSI]);

  return (
    <div className="h-full flex flex-col bg-[#0F0F11] border border-white/10 rounded-sm" data-testid="trading-chart">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-sm font-bold tracking-tight uppercase text-white" data-testid="chart-symbol">
            {symbol || "—"}
          </h2>
          <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mt-0.5">
            Análise Técnica · TradingView
          </p>
        </div>

        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              data-testid={`range-${r.id}`}
              onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-sm border transition-colors duration-150 ${
                range === r.id
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                  : "border-white/10 text-zinc-500 hover:text-white hover:border-zinc-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {OVERLAYS.map((o) => (
            <button
              key={o.id}
              data-testid={`overlay-${o.id}`}
              onClick={() => setEnabled((s) => ({ ...s, [o.id]: !s[o.id] }))}
              className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded-sm border transition-colors duration-150 ${
                enabled[o.id]
                  ? "bg-white/5 text-white border-white/20"
                  : "border-transparent text-zinc-600 hover:text-zinc-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="indicator-rsi"
            onClick={() => setShowRSI(true)}
            className={`px-2 py-0.5 text-[10px] font-mono rounded-sm border ${
              showRSI ? "bg-blue-500/20 text-blue-400 border-blue-500/40" : "border-white/10 text-zinc-500"
            }`}
          >
            RSI
          </button>
          <button
            data-testid="indicator-macd"
            onClick={() => setShowRSI(false)}
            className={`px-2 py-0.5 text-[10px] font-mono rounded-sm border ${
              !showRSI ? "bg-blue-500/20 text-blue-400 border-blue-500/40" : "border-white/10 text-zinc-500"
            }`}
          >
            MACD
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0F0F11]/60 z-10">
            <span className="font-mono text-xs text-zinc-400 tracking-widest" data-testid="chart-loading">
              CARREGANDO...
            </span>
          </div>
        )}
        <div ref={containerRef} className="w-full" style={{ height: "65%" }} />
        <div
          ref={subChartRef}
          className="w-full border-t border-white/10"
          style={{ height: "35%" }}
        />
      </div>
    </div>
  );
}
