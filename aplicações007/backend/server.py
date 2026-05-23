from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import market_service as market
from indicators import compute_all
from signals import generate_signal
from cache import cache


# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup (nothing yet)
    yield
    # shutdown
    client.close()


app = FastAPI(title="B3 Trading Analyst API", lifespan=lifespan)
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Default Watchlists ----------
DEFAULT_WATCHLIST = [
    "PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3",
    "B3SA3", "ABEV3", "WEGE3", "MGLU3", "RENT3",
    "RAIL3", "LREN3", "SUZB3", "GGBR4", "VIVT3",
    "PRIO3", "CSAN3", "USIM5", "CMIG4", "HAPV3"
]
INDICES = ["^BVSP", "^IFIX.SA"]  # IBOV via yfinance; we use BRAPI's own index endpoints


# ---------- Models ----------
class TradeEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    side: str  # "BUY" or "SELL"
    quantity: float
    entry_price: float
    exit_price: Optional[float] = None
    entry_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    exit_date: Optional[datetime] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    status: str = "OPEN"  # OPEN, CLOSED
    pnl: Optional[float] = None
    pnl_percent: Optional[float] = None


class TradeCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    side: str = Field(pattern=r"^(BUY|SELL)$")
    quantity: float = Field(gt=0)
    entry_price: float = Field(gt=0)
    stop_loss: Optional[float] = Field(default=None, gt=0)
    take_profit: Optional[float] = Field(default=None, gt=0)
    notes: Optional[str] = None


class TradeClose(BaseModel):
    exit_price: float = Field(gt=0)
    notes: Optional[str] = None


# ---------- Helper ----------
def _serialize_trade(t: dict) -> dict:
    """Ensure datetime fields are serialized as ISO strings for storage."""
    out = dict(t)
    for k in ("entry_date", "exit_date"):
        v = out.get(k)
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


def _deserialize_trade(t: dict) -> dict:
    out = dict(t)
    out.pop("_id", None)
    for k in ("entry_date", "exit_date"):
        v = out.get(k)
        if isinstance(v, str):
            try:
                out[k] = datetime.fromisoformat(v)
            except ValueError:
                pass
    return out


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "B3 Trading Analyst API", "status": "online"}


@api_router.get("/watchlist/default")
async def get_default_watchlist():
    """Return default B3 watchlist symbols."""
    return {"symbols": DEFAULT_WATCHLIST}


@api_router.get("/quote/{symbol}")
async def get_quote(symbol: str):
    """Get current quote for a single symbol."""
    q = await market.get_quote(symbol.upper())
    if not q:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    return q


@api_router.get("/quotes")
async def get_quotes(symbols: str = Query(..., description="Comma-separated tickers")):
    """Get current quotes for multiple symbols."""
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not syms:
        raise HTTPException(status_code=400, detail="No symbols provided")
    quotes = await market.get_quotes(syms)
    return {"quotes": quotes}


@api_router.get("/history/{symbol}")
async def get_history(symbol: str, range: str = Query("1mo")):
    """Get OHLCV historical candles for a symbol."""
    candles = await market.get_history(symbol.upper(), range)
    if not candles:
        raise HTTPException(status_code=404, detail=f"No history for {symbol}")
    return {"symbol": symbol.upper(), "range": range, "candles": candles}


@api_router.get("/indicators/{symbol}")
async def get_indicators(symbol: str, range: str = Query("3mo")):
    """Get historical candles + computed technical indicators."""
    candles = await market.get_history(symbol.upper(), range)
    if not candles:
        raise HTTPException(status_code=404, detail=f"No history for {symbol}")
    ind = compute_all(candles)
    return {"symbol": symbol.upper(), "range": range, "candles": candles, "indicators": ind}


@api_router.get("/signal/{symbol}")
async def get_signal(symbol: str, range: str = Query("3mo")):
    """Generate trading signal for a symbol using multi-indicator + volume analysis."""
    candles = await market.get_history(symbol.upper(), range)
    if not candles:
        raise HTTPException(status_code=404, detail=f"No history for {symbol}")
    quote = await market.get_quote(symbol.upper())
    sig = generate_signal(candles)
    return {
        "symbol": symbol.upper(),
        "quote": quote,
        **sig,
    }


@api_router.get("/suggestions")
async def get_suggestions(limit: int = Query(10, ge=1, le=20)):
    """
    Asset suggestions: scans default watchlist, ranks by signal strength.
    Cached for 30s to reduce Brapi load.
    """
    cache_key = f"suggestions:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    async def analyze(sym: str):
        try:
            candles = await market.get_history(sym, "3mo")
            if not candles or len(candles) < 30:
                return None
            quote = await market.get_quote(sym)
            sig = generate_signal(candles)
            return {
                "symbol": sym,
                "name": quote.get("shortName") if quote else sym,
                "price": quote.get("regularMarketPrice") if quote else None,
                "change_percent": quote.get("regularMarketChangePercent") if quote else None,
                "classification": sig["classification"],
                "score": sig["score"],
                "confidence": sig["confidence"],
                "reasons": sig["reasons"][:3],
                "indicators": sig["indicators"],
            }
        except Exception as e:
            logger.warning(f"suggestion analyze fail {sym}: {e}")
            return None

    results = await asyncio.gather(*[analyze(s) for s in DEFAULT_WATCHLIST])
    valid = [r for r in results if r is not None]
    valid.sort(key=lambda x: abs(x["score"]), reverse=True)
    payload = {"suggestions": valid[:limit]}
    cache.set(cache_key, payload, 30)
    return payload


@api_router.get("/stocks")
async def list_stocks(limit: int = Query(30, ge=1, le=100)):
    """List most active B3 stocks (sorted by volume)."""
    stocks = await market.list_b3_stocks(limit)
    return {"stocks": stocks}


@api_router.get("/market/summary")
async def market_summary():
    """
    Daily market summary: indices, top gainers/losers, active stocks.
    """
    # Indices
    index_symbols = ["^BVSP", "IFIX", "SMLL"]
    indices_data = []
    for idx in index_symbols:
        q = await market.get_quote(idx)
        if q:
            indices_data.append(q)

    # Get quotes for the default watchlist to derive movers
    watch_quotes = await market.get_quotes(DEFAULT_WATCHLIST)
    valid_quotes = [q for q in watch_quotes if q.get("regularMarketChangePercent") is not None]
    sorted_by_change = sorted(valid_quotes, key=lambda x: x["regularMarketChangePercent"], reverse=True)
    top_gainers = sorted_by_change[:5]
    top_losers = list(reversed(sorted_by_change[-5:]))
    most_active = sorted(
        [q for q in valid_quotes if q.get("regularMarketVolume")],
        key=lambda x: x["regularMarketVolume"],
        reverse=True,
    )[:5]

    return {
        "indices": indices_data,
        "top_gainers": top_gainers,
        "top_losers": top_losers,
        "most_active": most_active,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------- Trade Journal CRUD ----------
@api_router.post("/trades", response_model=TradeEntry)
async def create_trade(payload: TradeCreate):
    """Log a new trade entry."""
    if payload.side not in ("BUY", "SELL"):
        raise HTTPException(status_code=400, detail="side must be BUY or SELL")
    trade = TradeEntry(**payload.model_dump())
    doc = _serialize_trade(trade.model_dump())
    await db.trades.insert_one(doc)
    return trade


@api_router.get("/trades", response_model=List[TradeEntry])
async def list_trades(status: Optional[str] = None):
    """List all trades, optionally filtered by status (OPEN/CLOSED)."""
    query = {}
    if status:
        query["status"] = status.upper()
    rows = await db.trades.find(query, {"_id": 0}).sort("entry_date", -1).to_list(1000)
    return [TradeEntry(**_deserialize_trade(r)) for r in rows]


@api_router.get("/trades/stats")
async def trade_stats():
    """Aggregate trade statistics: win rate, total PnL, etc."""
    rows = await db.trades.find({"status": "CLOSED"}, {"_id": 0}).to_list(10000)
    if not rows:
        return {
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0,
            "total_pnl": 0,
            "avg_pnl": 0,
            "best_trade": 0,
            "worst_trade": 0,
            "open_trades": await db.trades.count_documents({"status": "OPEN"}),
        }
    pnls = [r.get("pnl", 0) or 0 for r in rows]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]
    return {
        "total_trades": len(rows),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(rows) * 100, 2) if rows else 0,
        "total_pnl": round(sum(pnls), 2),
        "avg_pnl": round(sum(pnls) / len(pnls), 2) if pnls else 0,
        "best_trade": round(max(pnls), 2) if pnls else 0,
        "worst_trade": round(min(pnls), 2) if pnls else 0,
        "open_trades": await db.trades.count_documents({"status": "OPEN"}),
    }


@api_router.patch("/trades/{trade_id}/close", response_model=TradeEntry)
async def close_trade(trade_id: str, payload: TradeClose):
    """Close a trade with exit price; computes PnL."""
    doc = await db.trades.find_one({"id": trade_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Trade not found")
    if doc.get("status") == "CLOSED":
        raise HTTPException(status_code=400, detail="Trade already closed")
    entry = doc["entry_price"]
    qty = doc["quantity"]
    side = doc["side"]
    if side == "BUY":
        pnl = (payload.exit_price - entry) * qty
        pnl_pct = ((payload.exit_price - entry) / entry) * 100 if entry else 0
    else:
        pnl = (entry - payload.exit_price) * qty
        pnl_pct = ((entry - payload.exit_price) / entry) * 100 if entry else 0
    update = {
        "exit_price": payload.exit_price,
        "exit_date": datetime.now(timezone.utc).isoformat(),
        "status": "CLOSED",
        "pnl": round(pnl, 2),
        "pnl_percent": round(pnl_pct, 2),
    }
    if payload.notes:
        update["notes"] = payload.notes
    await db.trades.update_one({"id": trade_id}, {"$set": update})
    new_doc = await db.trades.find_one({"id": trade_id}, {"_id": 0})
    return TradeEntry(**_deserialize_trade(new_doc))


@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str):
    res = await db.trades.delete_one({"id": trade_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trade not found")
    return {"deleted": True, "id": trade_id}


# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
