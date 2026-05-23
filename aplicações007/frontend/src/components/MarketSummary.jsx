import React, { useEffect, useState } from "react";
import { api, fmtPrice, fmtPercent, fmtCompact } from "../lib/api";
import { TrendUp, TrendDown, ChartBar, Newspaper } from "@phosphor-icons/react";

export default function MarketSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/market/summary");
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 60000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="font-mono text-xs text-zinc-500 text-center py-12" data-testid="summary-loading">
        CARREGANDO RESUMO DE MERCADO...
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="market-summary">
      <div>
        <h2 className="font-heading text-2xl font-bold tracking-tight text-white">
          Resumo Diário do Mercado
        </h2>
        <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mt-0.5">
          Atualizado {new Date(data.timestamp).toLocaleTimeString("pt-BR")}
        </p>
      </div>

      {/* Indices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="indices-row">
        {data.indices.map((idx) => (
          <IndexCard key={idx.symbol} q={idx} />
        ))}
      </div>

      {/* Macro summary text */}
      <div className="bg-[#0F0F11] border border-white/10 rounded-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Newspaper size={14} weight="fill" className="text-blue-500" />
          <h3 className="font-heading text-sm font-bold tracking-tight uppercase text-white">
            Panorama do Pregão
          </h3>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          {generateNarrative(data)}
        </p>
      </div>

      {/* Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MoverList title="Maiores Altas" items={data.top_gainers} variant="up" testid="gainers" />
        <MoverList title="Maiores Baixas" items={data.top_losers} variant="down" testid="losers" />
        <MoverList title="Mais Negociadas" items={data.most_active} variant="volume" testid="active" />
      </div>
    </div>
  );
}

function IndexCard({ q }) {
  const change = q.regularMarketChangePercent || 0;
  const isUp = change >= 0;
  return (
    <div className="bg-[#0F0F11] border border-white/10 rounded-sm px-4 py-3" data-testid={`index-${q.symbol}`}>
      <div className="flex items-center justify-between">
        <span className="font-heading text-sm font-bold tracking-tight uppercase text-zinc-300">
          {q.shortName || q.symbol}
        </span>
        <ChartBar size={12} className="text-zinc-600" />
      </div>
      <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
        {q.regularMarketPrice ? q.regularMarketPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
      </div>
      <div className={`mt-1 font-mono text-xs flex items-center gap-1 ${isUp ? "value-up" : "value-down"}`}>
        {isUp ? <TrendUp size={10} weight="bold" /> : <TrendDown size={10} weight="bold" />}
        {fmtPercent(change)} <span className="opacity-60">({q.regularMarketChange?.toFixed(2)})</span>
      </div>
    </div>
  );
}

function MoverList({ title, items, variant, testid }) {
  return (
    <div className="bg-[#0F0F11] border border-white/10 rounded-sm" data-testid={`movers-${testid}`}>
      <div className="px-4 py-2.5 border-b border-white/10">
        <h3 className="font-heading text-sm font-bold tracking-tight uppercase text-white">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-white/5">
        {items && items.length > 0 ? items.map((q) => (
          <div key={q.symbol} className="px-4 py-2 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-mono text-sm text-white font-semibold">{q.symbol}</span>
              <span className="font-mono text-[10px] text-zinc-500">
                {fmtPrice(q.regularMarketPrice)}
              </span>
            </div>
            {variant === "volume" ? (
              <span className="font-mono text-xs text-zinc-300 tabular-nums">
                {fmtCompact(q.regularMarketVolume)}
              </span>
            ) : (
              <span className={`font-mono text-xs tabular-nums ${variant === "up" ? "value-up" : "value-down"}`}>
                {fmtPercent(q.regularMarketChangePercent)}
              </span>
            )}
          </div>
        )) : (
          <div className="px-4 py-6 text-center font-mono text-xs text-zinc-600">Sem dados</div>
        )}
      </div>
    </div>
  );
}

function generateNarrative(data) {
  const ibov = data.indices.find((i) => i.symbol === "^BVSP" || i.symbol === "IBOV");
  const topG = data.top_gainers[0];
  const topL = data.top_losers[0];

  const parts = [];

  if (ibov && ibov.regularMarketChangePercent !== null) {
    const pct = ibov.regularMarketChangePercent;
    const dir = pct >= 0 ? "em alta" : "em baixa";
    parts.push(
      `O Ibovespa opera ${dir} de ${fmtPercent(pct)}, cotado a ${ibov.regularMarketPrice?.toLocaleString("pt-BR")} pontos.`
    );
  }

  if (topG) {
    parts.push(
      `Entre os destaques positivos, ${topG.symbol} lidera com valorização de ${fmtPercent(topG.regularMarketChangePercent)}.`
    );
  }
  if (topL) {
    parts.push(
      `Do lado negativo, ${topL.symbol} é o principal recuo com ${fmtPercent(topL.regularMarketChangePercent)}.`
    );
  }

  const avgChange =
    data.top_gainers.length + data.top_losers.length > 0
      ? [...data.top_gainers, ...data.top_losers].reduce(
          (s, q) => s + (q.regularMarketChangePercent || 0),
          0
        ) / (data.top_gainers.length + data.top_losers.length)
      : 0;
  const bias = avgChange > 0.3 ? "compradora" : avgChange < -0.3 ? "vendedora" : "lateralizada";
  parts.push(
    `O sentimento geral do mercado neste momento é ${bias}, com fluxo concentrado em blue chips e setores de commodities.`
  );

  return parts.join(" ");
}
