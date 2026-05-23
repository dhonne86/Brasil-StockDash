import React, { useEffect, useState } from "react";
import { api, fmtNumber, signalLabel, signalClass } from "../lib/api";
import { CaretRight, Lightning } from "@phosphor-icons/react";

export default function SignalPanel({ symbol }) {
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get(`/signal/${symbol}`);
        if (active) setSignal(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    const id = setInterval(async () => {
      try {
        const res = await api.get(`/signal/${symbol}`);
        if (active) setSignal(res.data);
      } catch (_) {}
    }, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [symbol]);

  const ind = signal?.indicators || {};
  const classification = signal?.classification || "HOLD";

  return (
    <div
      className="h-full flex flex-col bg-[#0F0F11] border border-white/10 rounded-sm"
      data-testid="signal-panel"
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-sm font-bold tracking-tight uppercase text-white flex items-center gap-2">
            <Lightning size={14} weight="fill" className="text-amber-500" />
            Sinal de Entrada
          </h2>
          <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mt-0.5">
            Multi-indicador + Volume
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="text-center font-mono text-xs text-zinc-500 py-8" data-testid="signal-loading">
            ANALISANDO...
          </div>
        )}

        {signal && !loading && (
          <>
            <div
              className={`px-4 py-3 rounded-sm border ${signalClass[classification]}`}
              data-testid="signal-classification"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-heading text-lg font-bold tracking-tight">
                  {signalLabel[classification]}
                </span>
                <span className="font-mono text-xs">SCORE {signal.score}</span>
              </div>
              <div className="mt-2 h-1 w-full bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-current"
                  style={{ width: `${signal.confidence}%` }}
                />
              </div>
              <div className="mt-1 font-mono text-[10px] tracking-widest uppercase opacity-70">
                CONFIANÇA {signal.confidence}%
              </div>
            </div>

            <div>
              <h3 className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mb-2">
                FATORES DETECTADOS
              </h3>
              <ul className="space-y-1.5" data-testid="signal-reasons">
                {(signal.reasons || []).map((r, i) => (
                  <li
                    key={i}
                    className="text-xs text-zinc-300 flex items-start gap-2 leading-relaxed"
                  >
                    <CaretRight size={10} weight="bold" className="text-blue-500 mt-1 flex-shrink-0" />
                    {r}
                  </li>
                ))}
                {(!signal.reasons || signal.reasons.length === 0) && (
                  <li className="text-xs text-zinc-600 italic">Nenhum fator forte detectado</li>
                )}
              </ul>
            </div>

            <div>
              <h3 className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mb-2">
                INDICADORES
              </h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <IndicatorRow label="RSI(14)" value={fmtNumber(ind.rsi, 2)} highlight={ind.rsi && (ind.rsi < 30 || ind.rsi > 70)} />
                <IndicatorRow label="MACD" value={fmtNumber(ind.macd, 4)} />
                <IndicatorRow label="MACD Signal" value={fmtNumber(ind.macd_signal, 4)} />
                <IndicatorRow label="Histograma" value={fmtNumber(ind.macd_histogram, 4)} highlight={ind.macd_histogram} />
                <IndicatorRow label="BB Sup" value={fmtNumber(ind.bb_upper, 2)} />
                <IndicatorRow label="BB Med" value={fmtNumber(ind.bb_middle, 2)} />
                <IndicatorRow label="BB Inf" value={fmtNumber(ind.bb_lower, 2)} />
                <IndicatorRow label="EMA 9" value={fmtNumber(ind.ema9, 2)} />
                <IndicatorRow label="EMA 21" value={fmtNumber(ind.ema21, 2)} />
                <IndicatorRow label="EMA 50" value={fmtNumber(ind.ema50, 2)} />
                <IndicatorRow label="Vol Ratio" value={ind.volume_ratio ? ind.volume_ratio + "x" : "—"} highlight={ind.volume_ratio && ind.volume_ratio > 1.5} />
                <IndicatorRow label="Preço" value={fmtNumber(ind.last_close, 2)} />
              </div>
            </div>
          </>
        )}

        {!signal && !loading && (
          <div className="text-center text-zinc-600 font-mono text-xs py-8">
            Selecione um ativo
          </div>
        )}
      </div>
    </div>
  );
}

function IndicatorRow({ label, value, highlight }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/5 py-1">
      <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">
        {label}
      </span>
      <span
        className={`font-mono text-xs tabular-nums ${
          highlight ? "text-amber-400" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
