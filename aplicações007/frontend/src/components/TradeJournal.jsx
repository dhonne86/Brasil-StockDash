import React, { useEffect, useState } from "react";
import { api, fmtPrice, fmtPercent, fmtNumber } from "../lib/api";
import { Plus, X, CheckCircle, TrendUp, TrendDown } from "@phosphor-icons/react";
import { toast } from "sonner";

const EMPTY_STATE_BG = "https://static.prod-images.emergentagent.com/jobs/c730b781-3072-4249-a9f4-76ba048993ab/images/224ce9be7e773c4d22e94672a107dbb40a8ddd2d10613700a61d2d870838120b.png";

export default function TradeJournal() {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [closing, setClosing] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    symbol: "",
    side: "BUY",
    quantity: "",
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    notes: "",
  });
  const [closeForm, setCloseForm] = useState({ exit_price: "", notes: "" });

  const fetchAll = async () => {
    try {
      const [tr, st] = await Promise.all([api.get("/trades"), api.get("/trades/stats")]);
      setTrades(tr.data);
      setStats(st.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.symbol || !form.quantity || !form.entry_price) {
      toast.error("Preencha ativo, quantidade e preço de entrada");
      return;
    }
    try {
      await api.post("/trades", {
        symbol: form.symbol.toUpperCase(),
        side: form.side,
        quantity: parseFloat(form.quantity),
        entry_price: parseFloat(form.entry_price),
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
        take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
        notes: form.notes || null,
      });
      toast.success("Operação registrada");
      setShowAdd(false);
      setForm({ symbol: "", side: "BUY", quantity: "", entry_price: "", stop_loss: "", take_profit: "", notes: "" });
      fetchAll();
    } catch (e) {
      toast.error("Erro ao registrar operação");
    }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    if (!closeForm.exit_price) {
      toast.error("Informe o preço de saída");
      return;
    }
    try {
      await api.patch(`/trades/${closing.id}/close`, {
        exit_price: parseFloat(closeForm.exit_price),
        notes: closeForm.notes || null,
      });
      toast.success("Operação encerrada");
      setClosing(null);
      setCloseForm({ exit_price: "", notes: "" });
      fetchAll();
    } catch (e) {
      toast.error("Erro ao encerrar");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Excluir esta operação?")) return;
    try {
      await api.delete(`/trades/${id}`);
      toast.success("Operação excluída");
      fetchAll();
    } catch (e) {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <div className="space-y-4" data-testid="trade-journal">
      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="journal-stats">
          <StatCard label="OPERAÇÕES" value={stats.total_trades} />
          <StatCard label="ABERTAS" value={stats.open_trades} accent="text-blue-400" />
          <StatCard label="VITÓRIAS" value={stats.wins} accent="text-emerald-500" />
          <StatCard label="DERROTAS" value={stats.losses} accent="text-red-500" />
          <StatCard label="WIN RATE" value={`${stats.win_rate}%`} />
          <StatCard
            label="PNL TOTAL"
            value={fmtPrice(stats.total_pnl)}
            accent={stats.total_pnl >= 0 ? "text-emerald-500" : "text-red-500"}
          />
        </div>
      )}

      {/* Header + add button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">
            Diário de Operações
          </h2>
          <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mt-0.5">
            Registre, monitore e analise suas operações
          </p>
        </div>
        <button
          data-testid="add-trade-btn"
          onClick={() => setShowAdd(true)}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-sm text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={14} weight="bold" />
          Nova Operação
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#0F0F11] border border-white/10 rounded-sm">
        <div className="px-4 py-2 grid grid-cols-12 gap-2 border-b border-white/10 sticky top-0 bg-[#0F0F11]">
          <Th className="col-span-1">Lado</Th>
          <Th className="col-span-1">Ativo</Th>
          <Th className="col-span-1 text-right">Qtde</Th>
          <Th className="col-span-2 text-right">Entrada</Th>
          <Th className="col-span-2 text-right">Saída</Th>
          <Th className="col-span-2 text-right">PnL</Th>
          <Th className="col-span-1 text-center">Status</Th>
          <Th className="col-span-2 text-right">Ações</Th>
        </div>

        {loading && (
          <div className="px-4 py-8 text-center font-mono text-xs text-zinc-500">CARREGANDO...</div>
        )}

        {!loading && trades.length === 0 && (
          <div
            className="px-4 py-16 text-center relative"
            style={{
              backgroundImage: `linear-gradient(rgba(15,15,17,0.85), rgba(15,15,17,0.85)), url(${EMPTY_STATE_BG})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            data-testid="empty-state"
          >
            <div className="font-heading text-sm text-zinc-400 tracking-tight">Sem operações registradas</div>
            <p className="font-mono text-[11px] text-zinc-600 mt-2 max-w-md mx-auto">
              Comece registrando sua primeira operação para acompanhar performance e identificar padrões.
            </p>
          </div>
        )}

        {trades.map((t) => (
          <div
            key={t.id}
            className="data-row px-4 py-2.5 grid grid-cols-12 gap-2 items-center"
            data-testid={`trade-row-${t.id}`}
          >
            <div className="col-span-1">
              <span
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded-sm tracking-widest ${
                  t.side === "BUY"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/15 text-red-400 border border-red-500/30"
                }`}
              >
                {t.side}
              </span>
            </div>
            <div className="col-span-1 font-mono text-sm font-semibold text-white">{t.symbol}</div>
            <div className="col-span-1 text-right font-mono text-xs text-zinc-300 tabular-nums">
              {fmtNumber(t.quantity, 0)}
            </div>
            <div className="col-span-2 text-right font-mono text-xs text-zinc-300 tabular-nums">
              {fmtPrice(t.entry_price)}
            </div>
            <div className="col-span-2 text-right font-mono text-xs text-zinc-300 tabular-nums">
              {t.exit_price ? fmtPrice(t.exit_price) : "—"}
            </div>
            <div className="col-span-2 text-right font-mono text-xs tabular-nums">
              {t.pnl !== null && t.pnl !== undefined ? (
                <span className={t.pnl >= 0 ? "value-up" : "value-down"}>
                  {fmtPrice(t.pnl)}{" "}
                  <span className="text-[10px] opacity-70">({fmtPercent(t.pnl_percent)})</span>
                </span>
              ) : (
                "—"
              )}
            </div>
            <div className="col-span-1 text-center">
              <span
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded-sm ${
                  t.status === "OPEN" ? "bg-blue-500/15 text-blue-400" : "bg-zinc-700/30 text-zinc-400"
                }`}
              >
                {t.status === "OPEN" ? "ABERTA" : "FECHADA"}
              </span>
            </div>
            <div className="col-span-2 flex items-center justify-end gap-1">
              {t.status === "OPEN" && (
                <button
                  data-testid={`close-trade-${t.id}`}
                  onClick={() => setClosing(t)}
                  className="px-2 py-1 text-[10px] font-mono uppercase border border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white rounded-sm transition-colors"
                >
                  Encerrar
                </button>
              )}
              <button
                data-testid={`delete-trade-${t.id}`}
                onClick={() => handleDelete(t.id)}
                className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <Modal title="Nova Operação" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-3" data-testid="add-trade-form">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ativo">
                <input
                  data-testid="form-symbol"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                  placeholder="PETR4"
                  className="trade-input"
                />
              </Field>
              <Field label="Lado">
                <select
                  data-testid="form-side"
                  value={form.side}
                  onChange={(e) => setForm({ ...form, side: e.target.value })}
                  className="trade-input"
                >
                  <option value="BUY">COMPRA</option>
                  <option value="SELL">VENDA</option>
                </select>
              </Field>
              <Field label="Quantidade">
                <input
                  data-testid="form-quantity"
                  type="number"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="trade-input"
                />
              </Field>
              <Field label="Preço de Entrada">
                <input
                  data-testid="form-entry-price"
                  type="number"
                  step="any"
                  value={form.entry_price}
                  onChange={(e) => setForm({ ...form, entry_price: e.target.value })}
                  className="trade-input"
                />
              </Field>
              <Field label="Stop Loss (opcional)">
                <input
                  data-testid="form-stop-loss"
                  type="number"
                  step="any"
                  value={form.stop_loss}
                  onChange={(e) => setForm({ ...form, stop_loss: e.target.value })}
                  className="trade-input"
                />
              </Field>
              <Field label="Take Profit (opcional)">
                <input
                  data-testid="form-take-profit"
                  type="number"
                  step="any"
                  value={form.take_profit}
                  onChange={(e) => setForm({ ...form, take_profit: e.target.value })}
                  className="trade-input"
                />
              </Field>
            </div>
            <Field label="Notas">
              <textarea
                data-testid="form-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="trade-input resize-none"
              />
            </Field>
            <button
              type="submit"
              data-testid="submit-trade-btn"
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-sm font-medium text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <CheckCircle size={14} weight="bold" />
              Registrar Operação
            </button>
          </form>
        </Modal>
      )}

      {closing && (
        <Modal title={`Encerrar ${closing.symbol}`} onClose={() => setClosing(null)}>
          <form onSubmit={handleClose} className="space-y-3" data-testid="close-trade-form">
            <Field label="Preço de Saída">
              <input
                data-testid="form-exit-price"
                type="number"
                step="any"
                value={closeForm.exit_price}
                onChange={(e) => setCloseForm({ ...closeForm, exit_price: e.target.value })}
                className="trade-input"
              />
            </Field>
            <Field label="Notas (opcional)">
              <textarea
                value={closeForm.notes}
                onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
                rows={2}
                className="trade-input resize-none"
              />
            </Field>
            <button
              type="submit"
              data-testid="submit-close-btn"
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-sm font-medium text-sm transition-colors"
            >
              Encerrar Operação
            </button>
          </form>
        </Modal>
      )}

      <style>{`
        .trade-input {
          width: 100%;
          background: #050505;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
          padding: 0.5rem 0.75rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8125rem;
          color: white;
          outline: none;
          transition: border-color 150ms;
        }
        .trade-input:focus {
          border-color: #3b82f6;
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, accent = "text-white" }) {
  return (
    <div className="bg-[#0F0F11] border border-white/10 rounded-sm px-3 py-2.5">
      <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{label}</div>
      <div className={`font-mono text-lg font-semibold mt-1 tabular-nums ${accent}`}>{value}</div>
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-widest uppercase text-zinc-500 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="modal-backdrop"
    >
      <div
        className="bg-[#0F0F11] border border-white/10 rounded-sm w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-base font-bold tracking-tight text-white">{title}</h3>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white">
            <X size={16} weight="bold" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
