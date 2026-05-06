import { useState, useEffect } from 'react';
import type { ProviderInfo } from '../types';

export default function Header() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [serverUp, setServerUp] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          setProviders(data.providers || []);
          setServerUp(true);
        } else {
          setServerUp(false);
        }
      } catch {
        setServerUp(false);
      }
    };
    check();
    const i = setInterval(check, 30000);
    return () => clearInterval(i);
  }, []);

  const activeProvider = providers.find(p => p.isDefault && p.healthy)
    || providers.find(p => p.healthy);

  return (
    <header className="h-11 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] flex items-center justify-between px-4 shrink-0 select-none">
      {/* Left — branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors cursor-pointer" />
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="text-sm font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            WebForge AI
          </span>
        </div>
      </div>

      {/* Center — server status */}
      <div className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all ${
        serverUp
          ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
          : 'text-red-400 border-red-500/20 bg-red-500/5'
      }`}>
        <div className={`w-1.5 h-1.5 rounded-full ${serverUp ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
        {serverUp ? (activeProvider?.displayName || 'Connected') : 'Offline'}
      </div>

      {/* Right — info */}
      <div className="flex items-center gap-2 text-[var(--text-muted)] text-[10px]">
        <span>v1.0</span>
      </div>
    </header>
  );
}
