"""
Technical Indicators Module
Computes RSI, MACD, Bollinger Bands, EMA, SMA from OHLCV price data.
"""
from typing import List, Dict, Optional
import math


def sma(values: List[float], period: int) -> List[Optional[float]]:
    """Simple Moving Average."""
    result: List[Optional[float]] = []
    for i in range(len(values)):
        if i < period - 1:
            result.append(None)
        else:
            window = values[i - period + 1 : i + 1]
            result.append(sum(window) / period)
    return result


def ema(values: List[float], period: int) -> List[Optional[float]]:
    """Exponential Moving Average."""
    result: List[Optional[float]] = [None] * len(values)
    if len(values) < period:
        return result
    k = 2 / (period + 1)
    # seed with SMA
    seed = sum(values[:period]) / period
    result[period - 1] = seed
    for i in range(period, len(values)):
        prev = result[i - 1]
        result[i] = values[i] * k + prev * (1 - k)
    return result


def rsi(values: List[float], period: int = 14) -> List[Optional[float]]:
    """Relative Strength Index."""
    result: List[Optional[float]] = [None] * len(values)
    if len(values) < period + 1:
        return result
    gains: List[float] = []
    losses: List[float] = []
    for i in range(1, len(values)):
        change = values[i] - values[i - 1]
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))
    # initial average
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    rs = avg_gain / avg_loss if avg_loss != 0 else float("inf")
    result[period] = 100 - (100 / (1 + rs)) if avg_loss != 0 else 100.0
    for i in range(period + 1, len(values)):
        gain = gains[i - 1]
        loss = losses[i - 1]
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        if avg_loss == 0:
            result[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            result[i] = 100 - (100 / (1 + rs))
    return result


def macd(values: List[float], fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, List[Optional[float]]]:
    """MACD line, signal line, and histogram."""
    ema_fast = ema(values, fast)
    ema_slow = ema(values, slow)
    macd_line: List[Optional[float]] = [
        (f - s) if (f is not None and s is not None) else None
        for f, s in zip(ema_fast, ema_slow)
    ]
    # Compute signal line from macd_line (only where defined)
    macd_values_clean = [v for v in macd_line if v is not None]
    start_index = next((i for i, v in enumerate(macd_line) if v is not None), 0)
    sig_clean = ema(macd_values_clean, signal)
    signal_line: List[Optional[float]] = [None] * len(values)
    for offset, val in enumerate(sig_clean):
        if val is not None:
            signal_line[start_index + offset] = val
    histogram: List[Optional[float]] = [
        (m - s) if (m is not None and s is not None) else None
        for m, s in zip(macd_line, signal_line)
    ]
    return {"macd": macd_line, "signal": signal_line, "histogram": histogram}


def bollinger_bands(values: List[float], period: int = 20, std_dev: float = 2.0) -> Dict[str, List[Optional[float]]]:
    """Bollinger Bands: upper, middle (SMA), lower."""
    middle = sma(values, period)
    upper: List[Optional[float]] = []
    lower: List[Optional[float]] = []
    for i in range(len(values)):
        if i < period - 1 or middle[i] is None:
            upper.append(None)
            lower.append(None)
        else:
            window = values[i - period + 1 : i + 1]
            mean = middle[i]
            variance = sum((x - mean) ** 2 for x in window) / period
            sd = math.sqrt(variance)
            upper.append(mean + std_dev * sd)
            lower.append(mean - std_dev * sd)
    return {"upper": upper, "middle": middle, "lower": lower}


def average_volume(volumes: List[float], period: int = 20) -> List[Optional[float]]:
    return sma(volumes, period)


def compute_all(candles: List[Dict]) -> Dict:
    """
    Compute all indicators from OHLCV candles.
    candles: [{ time, open, high, low, close, volume }, ...]
    """
    closes = [float(c["close"]) for c in candles]
    volumes = [float(c.get("volume", 0)) for c in candles]
    rsi_vals = rsi(closes, 14)
    macd_vals = macd(closes)
    bb = bollinger_bands(closes, 20, 2.0)
    ema9 = ema(closes, 9)
    ema21 = ema(closes, 21)
    ema50 = ema(closes, 50)
    avg_vol = average_volume(volumes, 20)
    return {
        "rsi": rsi_vals,
        "macd": macd_vals,
        "bollinger": bb,
        "ema9": ema9,
        "ema21": ema21,
        "ema50": ema50,
        "avg_volume": avg_vol,
    }
