import React, { useEffect, useState } from "react";
import { api, fmtPrice, fmtPercent, fmtCompact } from "../lib/api";
import { TrendUp, TrendDown, Plus } from "@phosphor-icons/react";

export default function Watchlist({ symbols, selected, onSelect, onAdd, onRemove }) {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState("");

  const fetchQuotes = async () => {
    if (!symbols.length) {
      setQuotes({});
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/quotes", {
        params: { symbols: symbols.join(",") },
      });
      const map = {};
      for (const q of res.data.quotes || []) {
        if (q.symbol) map[q.symbol] = q;
      }
      setQuotes(map);
    } catch (e) {
      console.error("watchlist fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchQuotes();
    const id = setInterval(fetchQuotes, 30000); // refresh every 30s
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [symbols.join(",")]);

  const handleAdd = (e) => {
    e.preventDefault();
    const s = newSymbol.trim().toUpperCase();
    if (s && !symbols.includes(s)) {
      onAdd(s);
      setNewSymbol("");
    }
  };

  return (
    <div
      className="h-full flex flex-col bg-[#0F0F11] border border-white/10 rounded-sm"
      data-testid="watchlist"
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-sm font-bold tracking-tight uppercase text-white">
            Watchlist
          </h2>
          <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mt-0.5">
            {symbols.length} ATIVOS · ATUALIZA 30s
          </p>
        </div>
      </div>

      <form
        onSubmit={handleAdd}
        className="px-3 py-2 border-b border-white/10 flex gap-2"
        data-testid="watchlist-add-form"
      >
        <input
          data-testid="watchlist-add-input"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="Adicionar ticker (ex: PETR4)"
          className="flex-1 bg-[#050505] border border-white/10 rounded-sm px-2 py-1.5 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          data-testid="watchlist-add-btn"
          className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-sm transition-colors"
        >
          <Plus size={14} weight="bold" />
        </button>
      </form>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-1.5 grid grid-cols-12 gap-2 border-b border-white/5 sticky top-0 bg-[#0F0F11]">
          <div className="col-span-4 font-mono text-[10px] tracking-widest uppercase text-zinc-600">Ativo</div>
          <div className="col-span-3 font-mono text-[10px] tracking-widest uppercase text-zinc-600 text-right">Preço</div>
          <div className="col-span-3 font-mono text-[10px] tracking-widest uppercase text-zinc-600 text-right">Var %</div>
          <div className="col-span-2 font-mono text-[10px] tracking-widest uppercase text-zinc-600 text-right">Vol</div>
        </div>

        {loading && (
          <div className="px-4 py-8 text-center text-zinc-500 font-mono text-xs" data-testid="watchlist-loading">
            CARREGANDO COTAÇÕES...
          </div>
        )}

        {!loading && symbols.map((sym) => {
          const q = quotes[sym];
          const change = q?.regularMarketChangePercent ?? 0;
          const isUp = change > 0;
          const isDown = change < 0;
          return (
            <div
              key={sym}
              data-testid={`watchlist-row-${sym}`}
              onClick={() => onSelect(sym)}
              className={`data-row px-3 py-2 grid grid-cols-12 gap-2 cursor-pointer ${
                selected === sym ? "active" : ""
              }`}
            >
              <div className="col-span-4 flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-white">{sym}</span>
              </div>
              <div className="col-span-3 text-right font-mono text-sm text-white tabular-nums">
                {q?.regularMarketPrice ? fmtPrice(q.regularMarketPrice) : "—"}
              </div>
              <div
                className={`col-span-3 text-right font-mono text-sm tabular-nums flex items-center justify-end gap-1 ${
                  isUp ? "value-up" : isDown ? "value-down" : "value-neutral"
                }`}
              >
                {isUp && <TrendUp size={10} weight="bold" />}
                {isDown && <TrendDown size={10} weight="bold" />}
                {q ? fmtPercent(change) : "—"}
              </div>
              <div className="col-span-2 text-right font-mono text-[11px] text-zinc-400 tabular-nums">
                {q?.regularMarketVolume ? fmtCompact(q.regularMarketVolume) : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
