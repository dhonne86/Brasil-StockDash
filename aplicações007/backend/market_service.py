"""
Market Data Service
- Primary: Brapi (Brazilian Stock Exchange API)
- Fallback: Yahoo Finance (yfinance)
Provides unified interface for quotes, historical candles, and market summary.
"""
import os
import logging
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone

import httpx
import yfinance as yf

from cache import cache

logger = logging.getLogger(__name__)

BRAPI_BASE = "https://brapi.dev/api"
BRAPI_TOKEN = os.environ.get("BRAPI_TOKEN", "")
DEFAULT_HEADERS = {"User-Agent": "Mozilla/5.0 (B3-Analyst/1.0)", "Accept": "application/json"}

# Global semaphore to throttle Brapi requests across the entire app
_BRAPI_SEM = asyncio.Semaphore(4)

# Cache TTLs (seconds)
TTL_QUOTE = 20
TTL_HISTORY_INTRADAY = 60        # 1d / 5d ranges
TTL_HISTORY_DAILY = 600          # 1mo+ ranges
TTL_LIST = 120
TTL_NEGATIVE = 300               # cache failed lookups to avoid retry storms

# Map Brapi range -> yfinance period/interval
RANGE_MAP = {
    "1d": ("1d", "5m"),
    "5d": ("5d", "15m"),
    "1mo": ("1mo", "1d"),
    "3mo": ("3mo", "1d"),
    "6mo": ("6mo", "1d"),
    "1y": ("1y", "1d"),
    "ytd": ("ytd", "1d"),
    "max": ("max", "1wk"),
}


def _yf_symbol(symbol: str) -> str:
    """Convert B3 ticker (e.g. PETR4) to yfinance format (PETR4.SA). Indices like ^BVSP pass through."""
    if symbol.startswith("^"):
        return symbol
    if "." in symbol:
        return symbol
    return f"{symbol}.SA"


async def _yf_quote_sync(symbol: str) -> Optional[Dict]:
    """Blocking yfinance quote fetch — to be run via asyncio.to_thread."""
    try:
        yf_sym = _yf_symbol(symbol)
        t = yf.Ticker(yf_sym)
        hist = t.history(period="2d", interval="1d")
        if hist.empty:
            return None
        last = hist.iloc[-1]
        prev_close = float(hist.iloc[-2]["Close"]) if len(hist) >= 2 else float(last["Open"])
        price = float(last["Close"])
        change = price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0.0
        long_name = None
        try:
            long_name = getattr(t.fast_info, "longName", None)
        except Exception:
            pass
        return {
            "symbol": symbol,
            "actualSymbol": symbol,
            "shortName": symbol,
            "longName": long_name or symbol,
            "regularMarketPrice": price,
            "regularMarketChange": change,
            "regularMarketChangePercent": change_pct,
            "regularMarketDayHigh": float(last["High"]),
            "regularMarketDayLow": float(last["Low"]),
            "regularMarketOpen": float(last["Open"]),
            "regularMarketPreviousClose": prev_close,
            "regularMarketVolume": float(last["Volume"]),
            "marketCap": None,
            "currency": "BRL",
            "logourl": None,
            "source": "yfinance",
        }
    except Exception as e:
        logger.warning(f"yfinance fallback failed for {symbol}: {e}")
        return None


async def get_quote(symbol: str) -> Optional[Dict]:
    """Get current quote for a symbol. Tries Brapi first, then yfinance. Cached for TTL_QUOTE."""
    cache_key = f"quote:{symbol}"
    cached = cache.get(cache_key)
    if cached is not None:
        # Negative cache marker
        return None if cached == "__MISS__" else cached

    # Try Brapi
    result: Optional[Dict] = None
    try:
        async with _BRAPI_SEM:
            async with httpx.AsyncClient(timeout=8.0, headers=DEFAULT_HEADERS) as client:
                params = {"token": BRAPI_TOKEN} if BRAPI_TOKEN else {}
                r = await client.get(f"{BRAPI_BASE}/quote/{symbol}", params=params)
                if r.status_code == 200:
                    data = r.json()
                    results = data.get("results", [])
                    if results:
                        q = results[0]
                        result = {
                            "symbol": symbol,  # Preserve requested symbol for consistent client mapping
                            "actualSymbol": q.get("symbol", symbol),
                            "shortName": q.get("shortName") or q.get("longName") or symbol,
                            "longName": q.get("longName"),
                            "regularMarketPrice": q.get("regularMarketPrice"),
                            "regularMarketChange": q.get("regularMarketChange"),
                            "regularMarketChangePercent": q.get("regularMarketChangePercent"),
                            "regularMarketDayHigh": q.get("regularMarketDayHigh"),
                            "regularMarketDayLow": q.get("regularMarketDayLow"),
                            "regularMarketOpen": q.get("regularMarketOpen"),
                            "regularMarketPreviousClose": q.get("regularMarketPreviousClose"),
                            "regularMarketVolume": q.get("regularMarketVolume"),
                            "marketCap": q.get("marketCap"),
                            "currency": q.get("currency", "BRL"),
                            "logourl": q.get("logourl"),
                            "source": "brapi",
                        }
    except Exception as e:
        logger.warning(f"Brapi quote failed for {symbol}: {e}")

    # Fallback to yfinance — run in thread with bounded timeout to avoid blocking
    if result is None:
        try:
            result = await asyncio.wait_for(asyncio.to_thread(_yf_quote_sync, symbol), timeout=4.0)
        except asyncio.TimeoutError:
            logger.warning(f"yfinance fallback timed out for {symbol}")
            result = None

    if result is None:
        # Negative cache so we don't pound the APIs for missing symbols
        cache.set(cache_key, "__MISS__", TTL_NEGATIVE)
        return None

    cache.set(cache_key, result, TTL_QUOTE)
    return result


async def _fetch_chunk(client: httpx.AsyncClient, symbols: List[str]) -> List[Dict]:
    """Fetch a small batch of symbols from Brapi (single HTTP call)."""
    params = {"token": BRAPI_TOKEN} if BRAPI_TOKEN else {}
    symbol_str = ",".join(symbols)
    out: List[Dict] = []
    try:
        r = await client.get(f"{BRAPI_BASE}/quote/{symbol_str}", params=params, timeout=10.0)
        if r.status_code == 200:
            data = r.json()
            for q in data.get("results", []):
                out.append({
                    "symbol": q.get("symbol"),
                    "shortName": q.get("shortName") or q.get("longName"),
                    "longName": q.get("longName"),
                    "regularMarketPrice": q.get("regularMarketPrice"),
                    "regularMarketChange": q.get("regularMarketChange"),
                    "regularMarketChangePercent": q.get("regularMarketChangePercent"),
                    "regularMarketDayHigh": q.get("regularMarketDayHigh"),
                    "regularMarketDayLow": q.get("regularMarketDayLow"),
                    "regularMarketOpen": q.get("regularMarketOpen"),
                    "regularMarketPreviousClose": q.get("regularMarketPreviousClose"),
                    "regularMarketVolume": q.get("regularMarketVolume"),
                    "marketCap": q.get("marketCap"),
                    "currency": q.get("currency", "BRL"),
                    "logourl": q.get("logourl"),
                    "source": "brapi",
                })
    except Exception as e:
        logger.warning(f"Brapi chunk failed for {symbol_str}: {e}")
    return out


async def get_quotes(symbols: List[str]) -> List[Dict]:
    """Batch fetch quotes. Uses the same per-symbol cache as get_quote (TTL_QUOTE)."""
    if not symbols:
        return []
    results_raw = await asyncio.gather(*[get_quote(s) for s in symbols])
    return [r for r in results_raw if r is not None]


def _yf_history_sync(symbol: str, range_key: str) -> List[Dict]:
    """Blocking yfinance history fetch — to be run via asyncio.to_thread."""
    try:
        yf_sym = _yf_symbol(symbol)
        period, yf_interval = RANGE_MAP.get(range_key, ("1mo", "1d"))
        df = yf.download(yf_sym, period=period, interval=yf_interval, progress=False, auto_adjust=False)
        if df.empty:
            return []
        if hasattr(df.columns, "nlevels") and df.columns.nlevels > 1:
            df.columns = df.columns.get_level_values(0)
        candles = []
        for ts, row in df.iterrows():
            try:
                candles.append({
                    "time": int(ts.timestamp()),
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": float(row["Volume"]) if "Volume" in row and not (row["Volume"] != row["Volume"]) else 0.0,
                })
            except (KeyError, ValueError, TypeError):
                continue
        return candles
    except Exception as e:
        logger.warning(f"yfinance history failed for {symbol}: {e}")
        return []


async def get_history(symbol: str, range_key: str = "1mo") -> List[Dict]:
    """
    Get historical OHLCV candles. Cached.
    Returns: [{ time, open, high, low, close, volume }, ...]
    'time' is a UNIX timestamp (seconds) for lightweight-charts.
    """
    cache_key = f"history:{symbol}:{range_key}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Try Brapi first
    brapi_interval_map = {
        "1d": "5m", "5d": "15m", "1mo": "1d", "3mo": "1d",
        "6mo": "1d", "1y": "1d", "ytd": "1d", "max": "1wk",
    }
    interval = brapi_interval_map.get(range_key, "1d")
    candles: List[Dict] = []
    try:
        async with _BRAPI_SEM:
            async with httpx.AsyncClient(timeout=15.0, headers=DEFAULT_HEADERS) as client:
                params = {
                    "range": range_key,
                    "interval": interval,
                    "fundamental": "false",
                    "dividends": "false",
                }
                if BRAPI_TOKEN:
                    params["token"] = BRAPI_TOKEN
                r = await client.get(f"{BRAPI_BASE}/quote/{symbol}", params=params)
                if r.status_code == 200:
                    data = r.json()
                    results = data.get("results", [])
                    if results:
                        hist = results[0].get("historicalDataPrice", []) or []
                        for h in hist:
                            try:
                                if h.get("open") is None or h.get("close") is None:
                                    continue
                                candles.append({
                                    "time": int(h["date"]),
                                    "open": float(h["open"]),
                                    "high": float(h["high"]),
                                    "low": float(h["low"]),
                                    "close": float(h["close"]),
                                    "volume": float(h.get("volume", 0) or 0),
                                })
                            except (KeyError, TypeError, ValueError):
                                continue
    except Exception as e:
        logger.warning(f"Brapi history failed for {symbol}: {e}")

    # Fallback to yfinance (in thread with timeout)
    if not candles:
        try:
            candles = await asyncio.wait_for(
                asyncio.to_thread(_yf_history_sync, symbol, range_key), timeout=8.0
            )
        except asyncio.TimeoutError:
            logger.warning(f"yfinance history timed out for {symbol}")
            candles = []

    ttl = TTL_HISTORY_INTRADAY if range_key in ("1d", "5d") else TTL_HISTORY_DAILY
    if candles:
        cache.set(cache_key, candles, ttl)
    else:
        cache.set(cache_key, [], TTL_NEGATIVE)
    return candles


async def list_b3_stocks(limit: int = 30) -> List[Dict]:
    """List most active B3 stocks via Brapi /quote/list. Cached for TTL_LIST."""
    cache_key = f"list:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    out: List[Dict] = []
    try:
        async with _BRAPI_SEM:
            async with httpx.AsyncClient(timeout=15.0, headers=DEFAULT_HEADERS) as client:
                params: Dict = {"limit": limit, "sortBy": "volume", "sortOrder": "desc"}
                if BRAPI_TOKEN:
                    params["token"] = BRAPI_TOKEN
                r = await client.get(f"{BRAPI_BASE}/quote/list", params=params)
                if r.status_code == 200:
                    data = r.json()
                    stocks = data.get("stocks", [])
                    out = [
                        {
                            "symbol": s.get("stock"),
                            "name": s.get("name"),
                            "close": s.get("close"),
                            "change": s.get("change"),
                            "volume": s.get("volume"),
                            "marketCap": s.get("market_cap"),
                            "sector": s.get("sector"),
                            "logo": s.get("logo"),
                        }
                        for s in stocks
                        if s.get("stock")
                    ]
    except Exception as e:
        logger.error(f"Brapi list failed: {e}")

    if out:
        cache.set(cache_key, out, TTL_LIST)
    return out
