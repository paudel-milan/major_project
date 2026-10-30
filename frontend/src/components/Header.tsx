import { useState, useEffect } from 'react';
import type { ProviderInfo } from '../types';
import ConfigIndicator from './ConfigIndicator';

interface Props {
  onOpenTokenDashboard?: () => void;
  tokenCount?: number;
  onStrategyChange?: (strategy: string) => void;
  onProviderChange?: (provider: string) => void;
  activeProvider?: string | null;
  activeStrategy?: string | null;
}

export default function Header({
  onOpenTokenDashboard,
  tokenCount,
  onStrategyChange,
  onProviderChange,
  activeProvider,
  activeStrategy,
}: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [serverUp, setServerUp] = useState(false);
  const [configProvider, setConfigProvider] = useState<string | null>(null);
  const [configStrategy, setConfigStrategy] = useState<string | null>(null);

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

  // Prefer the explicit selection (from ConfigIndicator / server config) over the poll-derived default
  const resolvedProvider = activeProvider || configProvider || null;
  const resolvedStrategy = activeStrategy || configStrategy || null;

  const providerForStatus = providers.find(p => p.isDefault && p.healthy)
    || providers.find(p => p.healthy);

  return (
    <header className="h-12 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)] flex items-center justify-between px-5 shrink-0 select-none">
      {/* Left — branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="text-sm font-semibold text-[var(--accent)] tracking-wide font-mono-mt">webforge</span>
          <span className="text-sm font-light text-[var(--text-muted)] font-mono-mt">ai</span>
        </div>
      </div>

      {/* Center — Config & LLM Indicator */}
      <div className="flex items-center gap-3">
        <ConfigIndicator onStrategyChange={onStrategyChange} onProviderChange={onProviderChange} />
        <div className={`flex items-center gap-1.5 text-[10px] font-mono font-medium px-2.5 py-1 rounded-md transition-all ${
          serverUp
            ? 'text-[var(--success)] bg-[var(--success)]/5'
            : 'text-[var(--error)] bg-[var(--error)]/5'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${serverUp ? 'bg-[var(--success)]' : 'bg-[var(--error)] animate-pulse'}`} />
          {serverUp ? (resolvedProvider ? (providers.find(p => p.name === resolvedProvider)?.displayName || resolvedProvider) : (providerForStatus?.displayName || 'connected')) : 'offline'}
        </div>
      </div>

      {/* Right — Token Dashboard Button & version */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenTokenDashboard}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent-surface)] hover:bg-[var(--accent)]/15 text-[var(--accent)] text-[11px] font-mono font-medium transition-all active:scale-[0.97]"
          title="Open Token Usage & Context Analytics Dashboard"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          <span>tokens</span>
          {tokenCount !== undefined && tokenCount > 0 && (
            <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)]">
              {tokenCount >= 1000 ? `${(tokenCount / 1000).toFixed(1)}k` : tokenCount}
            </span>
          )}
        </button>

        <span className="text-[var(--text-muted)] text-[10px] font-mono">v1.0</span>
      </div>
    </header>
  );
}
