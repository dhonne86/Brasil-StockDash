"""
B3 Trading Analyst Backend API Tests
Covers: health, watchlist, quotes (single/batch), history, indicators,
signals, suggestions, market summary, and trade journal CRUD.
"""
import os
import time
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load frontend/.env for REACT_APP_BACKEND_URL (public endpoint)
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

# Generous timeout - Brapi + indicators can take 10s+
T = 45


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=T)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("status") == "online"
        assert "B3" in data.get("message", "")


# ---------------- Watchlist ----------------
class TestWatchlist:
    def test_default(self, session):
        r = session.get(f"{API}/watchlist/default", timeout=T)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("symbols"), list)
        assert "PETR4" in data["symbols"]
        assert "VALE3" in data["symbols"]
        assert len(data["symbols"]) >= 10


# ---------------- Quote (single) ----------------
class TestQuoteSingle:
    @pytest.mark.parametrize("symbol", ["PETR4", "VALE3"])
    def test_valid_b3(self, session, symbol):
        r = session.get(f"{API}/quote/{symbol}", timeout=T)
        assert r.status_code == 200, f"{symbol}: {r.status_code} {r.text}"
        q = r.json()
        assert q.get("regularMarketPrice") is not None
        assert isinstance(q["regularMarketPrice"], (int, float))
        assert q["regularMarketPrice"] > 0
        assert q.get("source") in ("brapi", "yfinance")

    def test_index_bvsp(self, session):
        r = session.get(f"{API}/quote/^BVSP", timeout=T)
        # Either Brapi or yfinance must resolve IBOV
        assert r.status_code == 200, r.text
        q = r.json()
        assert q.get("regularMarketPrice") is not None

    def test_invalid_symbol_returns_404(self, session):
        r = session.get(f"{API}/quote/ZZZZZZ9", timeout=T)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


# ---------------- Quotes (batch) ----------------
class TestQuotesBatch:
    def test_batch(self, session):
        r = session.get(f"{API}/quotes", params={"symbols": "PETR4,VALE3,ITUB4"}, timeout=T)
        assert r.status_code == 200, r.text
        data = r.json()
        quotes = data.get("quotes", [])
        assert isinstance(quotes, list)
        assert len(quotes) >= 1, "expected at least one quote returned"
        # Client mapping field check (requested symbol preserved)
        returned_syms = {q.get("symbol") for q in quotes}
        # 'symbol' in batch endpoint is the REQUESTED symbol per market_service.get_quotes
        assert returned_syms.issubset({"PETR4", "VALE3", "ITUB4"}), f"Unexpected symbols: {returned_syms}"
        for q in quotes:
            assert "actualSymbol" in q, "batch quote must include actualSymbol for client mapping"
            assert q.get("regularMarketPrice") is not None

    def test_no_symbols_400(self, session):
        r = session.get(f"{API}/quotes", params={"symbols": ""}, timeout=T)
        # Either 400 or 422 acceptable for empty
        assert r.status_code in (400, 422), r.text


# ---------------- History ----------------
class TestHistory:
    @pytest.mark.parametrize("range_key", ["1mo", "3mo"])
    def test_history_ranges(self, session, range_key):
        r = session.get(f"{API}/history/PETR4", params={"range": range_key}, timeout=T)
        assert r.status_code == 200, r.text
        data = r.json()
        candles = data.get("candles", [])
        assert isinstance(candles, list)
        assert len(candles) > 5, f"Expected several candles for {range_key}, got {len(candles)}"
        c = candles[0]
        for k in ("time", "open", "high", "low", "close", "volume"):
            assert k in c, f"Missing key {k} in candle"
        assert isinstance(c["time"], int)
        assert c["high"] >= c["low"]

    def test_history_1y(self, session):
        r = session.get(f"{API}/history/VALE3", params={"range": "1y"}, timeout=T)
        assert r.status_code == 200, r.text
        candles = r.json().get("candles", [])
        assert len(candles) > 50


# ---------------- Indicators ----------------
class TestIndicators:
    def test_indicators_shape(self, session):
        r = session.get(f"{API}/indicators/PETR4", params={"range": "3mo"}, timeout=T)
        assert r.status_code == 200, r.text
        data = r.json()
        candles = data.get("candles", [])
        ind = data.get("indicators", {})
        n = len(candles)
        assert n > 30, f"Need >30 candles, got {n}"
        # Required indicator keys
        for k in ("rsi", "ema9", "ema21", "ema50", "avg_volume"):
            assert k in ind, f"Missing indicator: {k}"
            assert isinstance(ind[k], list), f"{k} should be list"
            assert len(ind[k]) == n, f"{k} length {len(ind[k])} != candles {n}"
        # MACD nested
        macd = ind.get("macd", {})
        for k in ("macd", "signal", "histogram"):
            assert k in macd, f"missing macd.{k}"
            assert len(macd[k]) == n, f"macd.{k} length mismatch"
        # Bollinger nested
        bb = ind.get("bollinger", {})
        for k in ("upper", "middle", "lower"):
            assert k in bb, f"missing bollinger.{k}"
            assert len(bb[k]) == n, f"bollinger.{k} length mismatch"


# ---------------- Signal ----------------
class TestSignal:
    def test_signal_petr4(self, session):
        r = session.get(f"{API}/signal/PETR4", timeout=T)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("classification") in ("STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"), d.get("classification")
        assert isinstance(d.get("score"), (int, float))
        conf = d.get("confidence")
        assert isinstance(conf, (int, float))
        assert 0 <= conf <= 100, f"confidence out of range: {conf}"
        assert isinstance(d.get("reasons"), list)
        ind = d.get("indicators", {})
        # Signal contract uses flat indicator keys
        for k in ("rsi", "macd", "macd_signal", "macd_histogram",
                  "bb_upper", "bb_middle", "bb_lower",
                  "ema9", "ema21", "ema50", "volume_ratio"):
            assert k in ind, f"signal.indicators missing {k}"


# ---------------- Suggestions ----------------
class TestSuggestions:
    def test_suggestions(self, session):
        r = session.get(f"{API}/suggestions", params={"limit": 10}, timeout=90)
        assert r.status_code == 200, r.text
        sugg = r.json().get("suggestions", [])
        assert isinstance(sugg, list)
        assert len(sugg) >= 3, f"Expected at least 3 suggestions, got {len(sugg)}"
        s0 = sugg[0]
        for k in ("symbol", "classification", "score", "confidence"):
            assert k in s0


# ---------------- Market Summary ----------------
class TestMarketSummary:
    def test_summary(self, session):
        r = session.get(f"{API}/market/summary", timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("indices", "top_gainers", "top_losers", "most_active", "timestamp"):
            assert k in d, f"missing {k}"
        assert isinstance(d["indices"], list)
        assert isinstance(d["top_gainers"], list)


# ---------------- Trade Journal CRUD ----------------
class TestTradeJournal:
    """Full CRUD lifecycle with create -> get -> close -> stats -> delete verification."""

    @pytest.fixture(scope="class")
    def created_trade(self, session):
        payload = {
            "symbol": "PETR4_TEST",
            "side": "BUY",
            "quantity": 100,
            "entry_price": 30.00,
            "stop_loss": 28.50,
            "take_profit": 33.00,
            "notes": "TEST_pytest_trade",
        }
        r = session.post(f"{API}/trades", json=payload, timeout=T)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t.get("id")
        assert t.get("status") == "OPEN"
        assert t.get("symbol") == "PETR4_TEST"
        assert t.get("side") == "BUY"
        assert t.get("quantity") == 100
        assert t.get("entry_price") == 30.00
        # MongoDB _id must not leak
        assert "_id" not in t
        yield t
        # teardown: ensure deleted
        session.delete(f"{API}/trades/{t['id']}", timeout=T)

    def test_create_and_persist(self, session, created_trade):
        # Verify persistence via GET /trades
        r = session.get(f"{API}/trades", timeout=T)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        assert created_trade["id"] in ids
        for t in r.json():
            assert "_id" not in t  # no Mongo internal id leakage

    def test_create_invalid_side(self, session):
        r = session.post(f"{API}/trades", json={
            "symbol": "X", "side": "FOO", "quantity": 1, "entry_price": 1.0
        }, timeout=T)
        assert r.status_code == 400

    def test_filter_open(self, session, created_trade):
        r = session.get(f"{API}/trades", params={"status": "OPEN"}, timeout=T)
        assert r.status_code == 200
        for t in r.json():
            assert t["status"] == "OPEN"

    def test_close_buy_computes_pnl(self, session, created_trade):
        # entry 30, exit 33, qty 100, BUY -> pnl = 300, pnl_pct = 10.0
        r = session.patch(
            f"{API}/trades/{created_trade['id']}/close",
            json={"exit_price": 33.0, "notes": "TEST_close"},
            timeout=T,
        )
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "CLOSED"
        assert t["pnl"] == 300.0, f"expected pnl 300.0, got {t['pnl']}"
        assert t["pnl_percent"] == 10.0, f"expected pnl_pct 10.0, got {t['pnl_percent']}"
        assert t["exit_price"] == 33.0

    def test_close_already_closed_400(self, session, created_trade):
        r = session.patch(
            f"{API}/trades/{created_trade['id']}/close",
            json={"exit_price": 34.0},
            timeout=T,
        )
        assert r.status_code == 400

    def test_stats(self, session, created_trade):
        r = session.get(f"{API}/trades/stats", timeout=T)
        assert r.status_code == 200
        s = r.json()
        for k in ("total_trades", "wins", "losses", "win_rate", "total_pnl", "open_trades"):
            assert k in s

    def test_sell_pnl(self, session):
        # Independent SELL trade for PnL formula check
        create = session.post(f"{API}/trades", json={
            "symbol": "VALE3_TEST", "side": "SELL", "quantity": 50,
            "entry_price": 70.0, "notes": "TEST_sell"
        }, timeout=T)
        assert create.status_code == 200
        tid = create.json()["id"]
        # SELL: entry 70 -> exit 65, qty 50 -> pnl = (70-65)*50 = 250, pnl% = 7.142857 ~ 7.14
        r = session.patch(f"{API}/trades/{tid}/close", json={"exit_price": 65.0}, timeout=T)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["pnl"] == 250.0
        assert abs(t["pnl_percent"] - 7.14) < 0.01
        # cleanup
        d = session.delete(f"{API}/trades/{tid}", timeout=T)
        assert d.status_code == 200

    def test_delete(self, session, created_trade):
        r = session.delete(f"{API}/trades/{created_trade['id']}", timeout=T)
        assert r.status_code == 200
        assert r.json().get("deleted") is True
        # Verify gone
        r2 = session.delete(f"{API}/trades/{created_trade['id']}", timeout=T)
        assert r2.status_code == 404
