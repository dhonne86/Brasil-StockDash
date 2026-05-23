"""
Trading Signals Engine
Generates BUY / SELL / HOLD signals based on multi-indicator + volume confluence.

Scoring system (range -10 to +10):
- RSI: oversold (<30) +2, overbought (>70) -2, neutral 0
- MACD: bullish cross / histogram positive +2; bearish -2
- Bollinger Bands: price near lower +1.5 / near upper -1.5
- EMA: price > EMA9 > EMA21 > EMA50 (uptrend) +2; opposite -2
- Volume: current > 1.5x avg volume +1 (confirms move direction)

Final classification:
  >= +4  -> STRONG BUY
  +2 to +3 -> BUY
  -1 to +1 -> HOLD
  -2 to -3 -> SELL
  <= -4 -> STRONG SELL
"""
from typing import Dict, List, Optional
from indicators import compute_all


def _last_defined(values: List[Optional[float]]) -> Optional[float]:
    for v in reversed(values):
        if v is not None:
            return v
    return None


def _idx_last_defined(values: List[Optional[float]]) -> Optional[int]:
    for i in range(len(values) - 1, -1, -1):
        if values[i] is not None:
            return i
    return None


def generate_signal(candles: List[Dict]) -> Dict:
    """
    Generate a trading signal from OHLCV candles.
    Returns dict with score, classification, reasons, indicator snapshot.
    """
    if not candles or len(candles) < 30:
        return {
            "classification": "HOLD",
            "score": 0,
            "reasons": ["Histórico insuficiente para análise"],
            "indicators": {},
            "confidence": 0,
        }

    ind = compute_all(candles)
    closes = [c["close"] for c in candles]
    volumes = [c.get("volume", 0) for c in candles]
    last_close = closes[-1]
    last_volume = volumes[-1]

    score = 0
    reasons: List[str] = []

    # RSI
    rsi_val = _last_defined(ind["rsi"])
    if rsi_val is not None:
        if rsi_val < 30:
            score += 2
            reasons.append(f"RSI sobrevendido ({rsi_val:.1f})")
        elif rsi_val < 40:
            score += 1
            reasons.append(f"RSI baixo ({rsi_val:.1f})")
        elif rsi_val > 70:
            score -= 2
            reasons.append(f"RSI sobrecomprado ({rsi_val:.1f})")
        elif rsi_val > 60:
            score -= 1
            reasons.append(f"RSI elevado ({rsi_val:.1f})")

    # MACD
    macd_line = ind["macd"]["macd"]
    signal_line = ind["macd"]["signal"]
    hist = ind["macd"]["histogram"]
    last_macd = _last_defined(macd_line)
    last_sig = _last_defined(signal_line)
    last_hist = _last_defined(hist)
    if last_macd is not None and last_sig is not None and last_hist is not None:
        # detect cross
        idx = _idx_last_defined(hist)
        if idx is not None and idx >= 1 and hist[idx - 1] is not None:
            prev_hist = hist[idx - 1]
            if prev_hist < 0 and last_hist > 0:
                score += 2
                reasons.append("MACD cruzou para cima (sinal de compra)")
            elif prev_hist > 0 and last_hist < 0:
                score -= 2
                reasons.append("MACD cruzou para baixo (sinal de venda)")
            elif last_hist > 0:
                score += 1
                reasons.append("MACD positivo (momentum altista)")
            elif last_hist < 0:
                score -= 1
                reasons.append("MACD negativo (momentum baixista)")

    # Bollinger Bands
    bb_upper = _last_defined(ind["bollinger"]["upper"])
    bb_lower = _last_defined(ind["bollinger"]["lower"])
    bb_mid = _last_defined(ind["bollinger"]["middle"])
    if bb_upper and bb_lower and bb_mid:
        band_width = bb_upper - bb_lower
        if band_width > 0:
            pct_b = (last_close - bb_lower) / band_width
            if pct_b < 0.1:
                score += 1.5
                reasons.append("Preço na banda inferior de Bollinger")
            elif pct_b < 0.25:
                score += 0.5
            elif pct_b > 0.9:
                score -= 1.5
                reasons.append("Preço na banda superior de Bollinger")
            elif pct_b > 0.75:
                score -= 0.5

    # EMA trend
    ema9 = _last_defined(ind["ema9"])
    ema21 = _last_defined(ind["ema21"])
    ema50 = _last_defined(ind["ema50"])
    if ema9 and ema21 and ema50:
        if last_close > ema9 > ema21 > ema50:
            score += 2
            reasons.append("Tendência de alta confirmada (EMA 9>21>50)")
        elif last_close < ema9 < ema21 < ema50:
            score -= 2
            reasons.append("Tendência de baixa confirmada (EMA 9<21<50)")
        elif ema9 > ema21:
            score += 1
            reasons.append("EMA curta acima da média (alta de curto prazo)")
        elif ema9 < ema21:
            score -= 1
            reasons.append("EMA curta abaixo da média (baixa de curto prazo)")

    # Volume confirmation
    avg_vol = _last_defined(ind["avg_volume"])
    if avg_vol and avg_vol > 0:
        vol_ratio = last_volume / avg_vol
        # confirm direction of recent move
        recent_change = closes[-1] - closes[-2] if len(closes) >= 2 else 0
        if vol_ratio > 1.5:
            if recent_change > 0:
                score += 1
                reasons.append(f"Volume {vol_ratio:.1f}x acima da média (confirma alta)")
            elif recent_change < 0:
                score -= 1
                reasons.append(f"Volume {vol_ratio:.1f}x acima da média (confirma baixa)")

    # Final classification
    if score >= 4:
        classification = "STRONG_BUY"
    elif score >= 2:
        classification = "BUY"
    elif score <= -4:
        classification = "STRONG_SELL"
    elif score <= -2:
        classification = "SELL"
    else:
        classification = "HOLD"

    confidence = min(100, int(abs(score) / 10 * 100))

    return {
        "classification": classification,
        "score": round(score, 2),
        "confidence": confidence,
        "reasons": reasons,
        "indicators": {
            "rsi": round(rsi_val, 2) if rsi_val is not None else None,
            "macd": round(last_macd, 4) if last_macd is not None else None,
            "macd_signal": round(last_sig, 4) if last_sig is not None else None,
            "macd_histogram": round(last_hist, 4) if last_hist is not None else None,
            "bb_upper": round(bb_upper, 2) if bb_upper else None,
            "bb_middle": round(bb_mid, 2) if bb_mid else None,
            "bb_lower": round(bb_lower, 2) if bb_lower else None,
            "ema9": round(ema9, 2) if ema9 else None,
            "ema21": round(ema21, 2) if ema21 else None,
            "ema50": round(ema50, 2) if ema50 else None,
            "last_close": round(last_close, 2),
            "last_volume": last_volume,
            "avg_volume": round(avg_vol, 0) if avg_vol else None,
            "volume_ratio": round(last_volume / avg_vol, 2) if avg_vol else None,
        },
    }
