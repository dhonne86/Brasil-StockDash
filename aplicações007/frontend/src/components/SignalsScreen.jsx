import React, { useEffect, useState } from "react";
import { api, fmtPrice, fmtPercent, signalLabel, signalClass } from "../lib/api";
import { ArrowsClockwise, Lightning } from "@phosphor-icons/react";

export default function SignalsScreen({ onSelect }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get("/suggestions", { params: { limit: 20 } });
      setData(res.data.suggestions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line
  }, []);

  const filtered =
    filter === "ALL"
      ? data
      : filter === "BUY"
      ? data.filter((d) => d.classification === "STRONG_BUY" || d.classification === "BUY")
      : data.filter((d) => d.classification === "STRONG_SELL" || d.classification === "SELL");

  return (
    <div className="space-y-4" data-testid="signals-screen">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Lightning size={20} weight="fill" className="text-amber-500" />
            Sinais de Entrada
          </h2>
          <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mt-0.5">
            Análise multi-indicador em ativos da carteira
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["ALL", "BUY", "SELL"].map((f) => (
            <button
              key={f}
              data-testid={`filter-${f.toLowerCase()}`}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[11px] font-mono rounded-sm border transition-colors ${
                filter === f
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                  : "border-white/10 text-zinc-500 hover:text-white"
              }`}
            >
              {f === "ALL" ? "TODOS" : f === "BUY" ? "COMPRA" : "VENDA"}
            </button>
          ))}
          <button
            data-testid="refresh-signals"
            onClick={fetch}
            disabled={loading}
            className="p-1.5 border border-white/10 hover:bg-white/5 rounded-sm transition-colors disabled:opacity-50"
          >
            <ArrowsClockwise size={12} weight="bold" className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="bg-[#0F0F11] border border-white/10 rounded-sm">
        <div className="px-4 py-2 grid grid-cols-12 gap-2 border-b border-white/10">
          <Th className="col-span-2">Ativo</Th>
          <Th className="col-span-2 text-right">Preço</Th>
          <Th className="col-span-2 text-right">Variação</Th>
          <Th className="col-span-2 text-center">Sinal</Th>
          <Th className="col-span-1 text-right">Score</Th>
          <Th className="col-span-1 text-right">Conf %</Th>
          <Th className="col-span-2">Fatores</Th>
        </div>

        {loading && (
          <div className="px-4 py-12 text-center font-mono text-xs text-zinc-500">
            ESCANEANDO ATIVOS...
          </div>
        )}

        {!loading && filtered.map((s) => (
          <div
            key={s.symbol}
            data-testid={`signal-row-${s.symbol}`}
            onClick={() => onSelect(s.symbol)}
            className="data-row px-4 py-3 grid grid-cols-12 gap-2 items-center cursor-pointer"
          >
            <div className="col-span-2">
              <div className="font-mono text-sm font-semibold text-white">{s.symbol}</div>
              <div className="font-mono text-[10px] text-zinc-500 truncate">{s.name}</div>
            </div>
            <div className="col-span-2 text-right font-mono text-sm text-white tabular-nums">
              {fmtPrice(s.price)}
            </div>
            <div className={`col-span-2 text-right font-mono text-sm tabular-nums ${s.change_percent >= 0 ? "value-up" : "value-down"}`}>
              {fmtPercent(s.change_percent)}
            </div>
            <div className="col-span-2 text-center">
              <span className={`px-2 py-0.5 text-[10px] font-mono rounded-sm tracking-wider ${signalClass[s.classification]}`}>
                {signalLabel[s.classification]}
              </span>
            </div>
            <div className="col-span-1 text-right font-mono text-sm text-white tabular-nums">{s.score}</div>
            <div className="col-span-1 text-right font-mono text-sm text-white tabular-nums">{s.confidence}</div>
            <div className="col-span-2 font-mono text-[10px] text-zinc-400 leading-tight">
              {s.reasons.slice(0, 2).join(" · ")}
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-12 text-center font-mono text-xs text-zinc-600">
            Nenhum sinal correspondente
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <div className={`font-mono text-[10px] tracking-widest uppercase text-zinc-600 ${className}`}>
      {children}
    </div>
  );
}
