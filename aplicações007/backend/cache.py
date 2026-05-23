"""
Simple in-memory TTL cache for market data.
Reduces external API load and speeds up repeat reads within the TTL window.
"""
import time
import asyncio
from typing import Any, Callable, Awaitable, Optional


class TTLCache:
    """Async-safe in-memory cache with per-key TTL."""

    def __init__(self):
        self._store: dict[str, tuple[float, Any]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()

    def get(self, key: str) -> Optional[Any]:
        rec = self._store.get(key)
        if not rec:
            return None
        expires_at, value = rec
        if expires_at < time.time():
            # expired
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl: float) -> None:
        self._store[key] = (time.time() + ttl, value)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    async def get_or_set(
        self,
        key: str,
        ttl: float,
        producer: Callable[[], Awaitable[Any]],
    ) -> Any:
        """
        Returns cached value if present. Otherwise calls producer() under
        a per-key lock to prevent duplicate fetches (thundering herd).
        """
        cached = self.get(key)
        if cached is not None:
            return cached

        async with self._global_lock:
            lock = self._locks.setdefault(key, asyncio.Lock())

        async with lock:
            # Re-check inside the lock (another coroutine may have populated it)
            cached = self.get(key)
            if cached is not None:
                return cached
            value = await producer()
            if value is not None:
                self.set(key, value, ttl)
            return value


# Module-level singleton
cache = TTLCache()
