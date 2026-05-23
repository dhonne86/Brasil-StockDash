import React from "react";
import { Pulse, ChartLine } from "@phosphor-icons/react";

const APP_LOGO = "https://static.prod-images.emergentagent.com/jobs/c730b781-3072-4249-a9f4-76ba048993ab/images/2621514318c716338dbdb5a42d64d3024f0e86469c42d51b1dafa7dfe43f6edc.png";

export default function Header({ activeTab, onTabChange, marketStatus = "OPEN" }) {
  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "signals", label: "Sinais" },
    { id: "journal", label: "Trade Journal" },
    { id: "summary", label: "Resumo" },
  ];

  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <header
      data-testid="app-header"
      className="border-b border-white/10 bg-[#050505] sticky top-0 z-40"
    >
      <div className="px-6 py-3 flex items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3" data-testid="app-logo">
          <img src={APP_LOGO} alt="B3 Analyst" className="h-8 w-8" />
          <div className="flex flex-col leading-none">
            <span className="font-heading text-base font-bold tracking-tight text-white">
              B3 ANALYST
            </span>
            <span className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase">
              Day Trading Terminal
            </span>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1" data-testid="main-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium font-heading tracking-tight transition-all duration-150 btn-tactical rounded-sm border ${
                activeTab === tab.id
                  ? "text-white bg-zinc-900 border-zinc-700"
                  : "text-zinc-500 hover:text-white border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right info */}
        <div className="ml-auto flex items-center gap-6" data-testid="header-status">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full pulse-dot ${
                marketStatus === "OPEN" ? "bg-emerald-500" : "bg-zinc-600"
              }`}
            />
            <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-400">
              MERCADO {marketStatus === "OPEN" ? "ABERTO" : "FECHADO"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-500">
            <Pulse size={14} weight="bold" />
            <span className="font-mono text-xs text-zinc-300">B3 / IBOV</span>
          </div>
          <div className="font-mono text-xs text-zinc-400" data-testid="clock">
            {timeStr}
          </div>
        </div>
      </div>
    </header>
  );
}
