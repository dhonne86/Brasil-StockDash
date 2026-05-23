import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 30000,
});

export const fmtPrice = (v, currency = "BRL") => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return v.toFixed(2);
  }
};

export const fmtNumber = (v, digits = 2) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
};

export const fmtCompact = (v) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toFixed(0);
};

export const fmtPercent = (v, digits = 2) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
};

export const signalLabel = {
  STRONG_BUY: "COMPRA FORTE",
  BUY: "COMPRA",
  HOLD: "NEUTRO",
  SELL: "VENDA",
  STRONG_SELL: "VENDA FORTE",
};

export const signalClass = {
  STRONG_BUY: "signal-strong-buy",
  BUY: "signal-buy",
  HOLD: "signal-hold",
  SELL: "signal-sell",
  STRONG_SELL: "signal-strong-sell",
};
