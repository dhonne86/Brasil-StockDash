import React, { useEffect, useState } from "react";
import "@/App.css";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import TradeJournal from "./components/TradeJournal";
import SignalsScreen from "./components/SignalsScreen";
import MarketSummary from "./components/MarketSummary";
import { Toaster } from "sonner";

const STORAGE_KEY = "b3_watchlist";

const DEFAULT_SYMBOLS = [
  "PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3",
  "B3SA3", "ABEV3", "WEGE3", "MGLU3", "RENT3",
  "RAIL3", "LREN3", "SUZB3", "GGBR4", "VIVT3",
  "PRIO3", "CSAN3", "USIM5", "CMIG4", "HAPV3",
];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [symbols, setSymbols] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_SYMBOLS;
  });
  const [selected, setSelected] = useState(symbols[0] || "PETR4");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  }, [symbols]);

  const addSymbol = (s) => {
    if (!symbols.includes(s)) setSymbols([s, ...symbols]);
    setSelected(s);
  };
  const removeSymbol = (s) => {
    setSymbols(symbols.filter((x) => x !== s));
    if (selected === s) setSelected(symbols.find((x) => x !== s) || "PETR4");
  };
  const handleSelect = (s) => {
    if (!symbols.includes(s)) setSymbols([s, ...symbols]);
    setSelected(s);
    if (activeTab !== "dashboard") setActiveTab("dashboard");
  };

  // Determine market open (B3 session: 10:00 - 17:00 BRT, Mon-Fri)
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const hourBrt = (now.getUTCHours() - 3 + 24) % 24;
  const marketStatus =
    dayOfWeek >= 1 && dayOfWeek <= 5 && hourBrt >= 10 && hourBrt < 17 ? "OPEN" : "CLOSED";

  return (
    <div className="App grain min-h-screen">
      <Header activeTab={activeTab} onTabChange={setActiveTab} marketStatus={marketStatus} />
      <main className="p-4 lg:p-6 max-w-[1800px] mx-auto fade-in-up" data-testid="main-content">
        {activeTab === "dashboard" && (
          <Dashboard
            symbols={symbols}
            selected={selected}
            onSelect={handleSelect}
            onAddSymbol={addSymbol}
            onRemoveSymbol={removeSymbol}
          />
        )}
        {activeTab === "signals" && <SignalsScreen onSelect={handleSelect} />}
        {activeTab === "journal" && <TradeJournal />}
        {activeTab === "summary" && <MarketSummary />}
      </main>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0F0F11",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fafafa",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
          },
        }}
      />
    </div>
  );
}

export default App;
