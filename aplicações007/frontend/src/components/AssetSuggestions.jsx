import React, { useEffect, useState } from "react";
import { api, fmtPrice, fmtPercent, signalLabel, signalClass } from "../lib/api";
import { Target, ArrowsClockwise } from "@phosphor-icons/react";

export default function AssetSuggestions({ onSelect }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get("/suggestions", { params: { limit: 12 } });
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

  return (
    <div
      className="h-full flex flex-col bg-[#0F0F11] border border-white/10 rounded-sm"
      data-testid="asset-suggestions"
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-sm font-bold tracking-tight uppercase text-white flex items-center gap-2">
            <Target size={14} weight="fill" className="text-blue-500" />
            Oportunidades
          </h2>
          <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mt-0.5">
            Ranqueado por força do sinal
          </p>
        </div>
        <button
          data-testid="refresh-suggestions"
          onClick={fetch}
          disabled={loading}
          className="p-1.5 border border-white/10 hover:bg-white/5 rounded-sm transition-colors disabled:opacity-50"
        >
          <ArrowsClockwise size={12} weight="bold" className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-4 py-8 text-center font-mono text-xs text-zinc-500" data-testid="suggestions-loading">
            ESCANEANDO ATIVOS...
          </div>
        )}
        {!loading && data.map((s) => (
          <div
            key={s.symbol}
            data-testid={`suggestion-${s.symbol}`}
            onClick={() => onSelect && onSelect(s.symbol)}
            className="data-row px-4 py-2.5 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-white">{s.symbol}</span>
                <span
                  className={`px-1.5 py-0.5 text-[9px] font-mono rounded-sm ${signalClass[s.classification]}`}
                >
                  {signalLabel[s.classification]}
                </span>
              </div>
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                {fmtPrice(s.price)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className={`font-mono ${s.change_percent >= 0 ? "value-up" : "value-down"}`}>
                {fmtPercent(s.change_percent)}
              </span>
              <span className="font-mono text-zinc-500">
                Score <span className="text-white">{s.score}</span> · Conf{" "}
                <span className="text-white">{s.confidence}%</span>
              </span>
            </div>
          </div>
        ))}
        {!loading && data.length === 0 && (
          <div className="px-4 py-8 text-center font-mono text-xs text-zinc-600">
            Nenhuma sugestão disponível
          </div>
        )}
      </div>
    </div>
  );
}
