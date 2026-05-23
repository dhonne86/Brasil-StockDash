# B3 Trading Analyst - PRD

## Original Problem Statement
Create a professional finance analyst application for day trading on the B3 (Brazilian Stock Exchange). The app should feature a real-time (or near real-time) dashboard for tracking Brazilian stocks and indices (using integrations like Yahoo Finance or Brapi), advanced technical analysis charts (RSI, MACD, Bollinger Bands), a trade journal to log operations, and a daily market summary. The interface should be clean, dark-themed, and optimized for high-performance monitoring. Plus: entry signals for operations and asset recommendations.

## User Choices (gathered via ask_human)
- Market data API: **Both** Brapi (primary, token: `7F8LKkWRb49vkYZsb6J5i9`) + Yahoo Finance fallback
- Chart library: **TradingView lightweight-charts**
- Authentication: **None** (single-user local app)
- Signal criteria: **Multiple indicators + volume**
- Language: **Portuguese (pt-BR)**

## Architecture
- **Backend**: FastAPI (Python). Files: `server.py` (routes), `market_service.py` (Brapi+yfinance), `indicators.py` (RSI/MACD/BB/EMA), `signals.py` (scoring engine)
- **Frontend**: React 19 + Tailwind + Shadcn UI. TradingView lightweight-charts for OHLCV+overlays. Phosphor icons. Sonner toasts.
- **Storage**: MongoDB (for Trade Journal); LocalStorage (for watchlist persistence)
- **Design**: "Tactical Swiss" dark theme — Chivo (headings), IBM Plex Sans (body), JetBrains Mono (numbers). Pure dark `#050505` background, green/red semantic colors, 4px border radius, Control Room Grid layout.

## User Personas
- **Day trader**: monitors B3 tickers, analyzes technical signals, logs operations, tracks PnL.

## Core Requirements (static)
1. Real-time/near real-time quotes for B3 stocks + IBOV/IFIX/SMLL indices
2. Candlestick chart with RSI, MACD, Bollinger Bands, EMA 9/21/50 overlays
3. Multi-indicator + volume signal engine (5 classifications)
4. Trade journal CRUD with PnL computation and aggregated stats
5. Daily market summary (gainers/losers/active stocks)
6. Asset suggestions ranked by signal strength
7. Dark high-density interface for high-performance monitoring

## Implemented (Feb 2026 / iteration 1)
- ✅ Brapi integration with Mozilla User-Agent + global semaphore(4) — overcomes Brapi 401 default-UA block and concurrency limits
- ✅ Yahoo Finance fallback via yfinance (auto kicks in for non-Brapi symbols)
- ✅ All 14 backend endpoints (quote, quotes, history, indicators, signal, suggestions, market/summary, trades CRUD + stats)
- ✅ React dashboard with 4 tabs: Dashboard, Sinais, Trade Journal, Resumo
- ✅ TradingView candle chart with locale=pt-BR + sub-chart for RSI/MACD toggle
- ✅ Bollinger/EMA9/EMA21/EMA50 overlays toggleable
- ✅ Signal panel with score / confidence / reasons / 14 indicator values
- ✅ Asset Suggestions ranked by abs(score) descending
- ✅ Trade Journal: add/list/close/delete + win rate, total PnL, best/worst trade
- ✅ Market summary with narrative paragraph + gainers/losers/active
- ✅ Watchlist persisted via localStorage
- ✅ Market open/closed indicator (10h-17h BRT, Mon-Fri)
- ✅ 100% backend test pass (23/23) via testing agent

## Bug Fixes
- **CRITICAL**: server.py was importing market_service BEFORE load_dotenv, causing BRAPI_TOKEN to be empty → all Brapi calls returned 401. Fixed by moving load_dotenv before imports.
- **CRITICAL**: Brapi blocks default httpx User-Agent → added Mozilla UA in DEFAULT_HEADERS.
- **CRITICAL**: TradingView locale "en-US@posix" runtime error in playwright → added `localization: { locale: "pt-BR" }`.
- Removed renamed tickers (JBSS3, ELET3, EMBR3) from default watchlist since Brapi renames them to JBSS32/AXIA3/EMBJ3; replaced with USIM5, CMIG4, HAPV3.

## P0/P1/P2 Backlog
### P1 — High value, near-term
- Quote caching layer (e.g., 15-30s TTL) for /api/quotes & /api/suggestions to avoid Brapi rate-limit pressure
- Price alerts (target/stop notifications when current price crosses threshold)
- Server-side WebSocket push for live ticks (currently polling every 15-30s)

### P2 — Nice-to-have
- TradeCreate pydantic validators (quantity > 0, entry_price > 0)
- Migrate `@app.on_event("shutdown")` to FastAPI lifespan
- Expose `list_b3_stocks` route (currently dead code)
- Backtesting module for strategy validation
- Multi-user mode + auth (if needed)
- CSV/Excel export of trade journal
- Custom alerts via signal threshold

## Next Action Items
- (User feedback) Iterate based on user reaction to v1
- Consider implementing P1 quote caching to reduce Brapi load
- Optional revenue lever: premium tier with real-time WebSockets + alerts
