import React, { useEffect, useState } from "react";
import { api, fmtPrice, fmtPercent, fmtCompact } from "../lib/api";
import Watchlist from "./Watchlist";
import TradingChart from "./TradingChart";
import SignalPanel from "./SignalPanel";
import AssetSuggestions from "./AssetSuggestions";
import { TrendUp, TrendDown } from "@phosphor-icons/react";

export default function Dashboard({ symbols, selected, onSelect, onAddSymbol, onRemoveSymbol }) {
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const fetchQuote = async () => {
      try {
        const res = await api.get(`/quote/${selected}`);
        if (active) setQuote(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchQuote();
    const id = setInterval(fetchQuote, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [selected]);

  return (
    <div className="space-y-3" data-testid="dashboard">
      {/* North-star metrics bar */}
      <div className="grid grid-cols-12 gap-3" data-testid="north-star-bar">
        <Metric
          label="ATIVO SELECIONADO"
          value={selected || "—"}
          sub={quote?.longName || quote?.shortName || ""}
          big
          testid="metric-symbol"
        />
        <Metric
          label="PREÇO"
          value={quote?.regularMarketPrice ? fmtPrice(quote.regularMarketPrice) : "—"}
          sub={`Abertura ${quote?.regularMarketOpen ? fmtPrice(quote.regularMarketOpen) : "—"}`}
          testid="metric-price"
        />
        <Metric
          label="VARIAÇÃO"
          value={quote?.regularMarketChangePercent !== undefined ? fmtPercent(quote.regularMarketChangePercent) : "—"}
          sub={quote?.regularMarketChange ? fmtPrice(quote.regularMarketChange) : ""}
          accent={
            quote?.regularMarketChangePercent > 0
              ? "value-up"
              : quote?.regularMarketChangePercent < 0
              ? "value-down"
              : ""
          }
          icon={
            quote?.regularMarketChangePercent > 0 ? (
              <TrendUp size={14} weight="bold" className="text-emerald-500" />
            ) : quote?.regularMarketChangePercent < 0 ? (
              <TrendDown size={14} weight="bold" className="text-red-500" />
            ) : null
          }
          testid="metric-change"
        />
        <Metric
          label="MÁX/MÍN DIA"
          value={
            quote?.regularMarketDayHigh
              ? `${fmtPrice(quote.regularMarketDayHigh)}`
              : "—"
          }
          sub={
            quote?.regularMarketDayLow
              ? `Mín ${fmtPrice(quote.regularMarketDayLow)}`
              : ""
          }
          testid="metric-range"
        />
        <Metric
          label="VOLUME"
          value={quote?.regularMarketVolume ? fmtCompact(quote.regularMarketVolume) : "—"}
          sub={quote?.source ? `via ${quote.source}` : ""}
          testid="metric-volume"
        />
        <Metric
          label="FECHAMENTO ANT."
          value={quote?.regularMarketPreviousClose ? fmtPrice(quote.regularMarketPreviousClose) : "—"}
          sub={quote?.currency || "BRL"}
          testid="metric-prev-close"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-3" style={{ minHeight: "70vh" }}>
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-3 min-h-[600px]">
          <div className="flex-1 min-h-[300px]">
            <Watchlist
              symbols={symbols}
              selected={selected}
              onSelect={onSelect}
              onAdd={onAddSymbol}
              onRemove={onRemoveSymbol}
            />
          </div>
          <div className="flex-1 min-h-[280px]">
            <AssetSuggestions onSelect={onSelect} />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 min-h-[600px]">
          <TradingChart symbol={selected} />
        </div>

        <div className="col-span-12 lg:col-span-3 min-h-[600px]">
          <SignalPanel symbol={selected} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, accent = "", icon = null, big = false, testid }) {
  return (
    <div
      data-testid={testid}
      className={`bg-[#0F0F11] border border-white/10 rounded-sm px-4 py-2.5 ${
        big ? "col-span-12 sm:col-span-3 lg:col-span-2" : "col-span-6 sm:col-span-2"
      }`}
    >
      <div className="font-mono text-[9px] tracking-widest uppercase text-zinc-500">{label}</div>
      <div className={`mt-1 font-heading text-lg font-bold tracking-tight tabular-nums flex items-center gap-1.5 ${accent}`}>
        {icon}
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[10px] text-zinc-500 mt-0.5 truncate">{sub}</div>
      )}
    </div>
  );
}
