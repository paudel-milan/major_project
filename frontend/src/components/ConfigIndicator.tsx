/**
 * ConfigIndicator — Interactive LLM Provider + Context Strategy controller.
 * Fetches from /api/config and allows runtime switching for both Multiple LLMs
 * and Multiple Context Strategies (including our custom Selective Summarization).
 */

import { useState, useEffect, useRef } from 'react';
import type { ConfigInfo, ProviderInfo } from '../types';

function getStrategyDisplayName(strategy: string): string {
  switch (strategy) {
    case 'recursive_summarization': return 'recursive summarization';
    case 'sliding_window': return 'sliding window';
    case 'selective_summarization': return 'selective semantic';
    default: return strategy;
  }
}

interface Props {
  onStrategyChange?: (strategy: string) => void;
  onProviderChange?: (provider: string) => void;
}

export default function ConfigIndicator({ onStrategyChange, onProviderChange }: Props) {
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [switchingStrategy, setSwitchingStrategy] = useState(false);
  const [switchingProvider, setSwitchingProvider] = useState(false);

  const strategyDropdownRef = useRef<HTMLDivElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch config on mount & periodically
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // silently fail — will just not show config
    }
  };

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(fetchConfig, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (strategyDropdownRef.current && !strategyDropdownRef.current.contains(e.target as Node)) {
        setShowStrategyDropdown(false);
      }
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target as Node)) {
        setShowProviderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleStrategySwitch = async (strategy: string) => {
    if (!config || strategy === config.strategy) {
      setShowStrategyDropdown(false);
      return;
    }

    setSwitchingStrategy(true);
    try {
      const res = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => prev ? { ...prev, strategy: data.strategy } : prev);
        onStrategyChange?.(data.strategy);
      }
    } catch (err) {
      console.error('[Config] Strategy switch failed:', err);
    } finally {
      setSwitchingStrategy(false);
      setShowStrategyDropdown(false);
    }
  };

  const handleProviderSwitch = async (providerName: string) => {
    if (!config || providerName === config.provider) {
      setShowProviderDropdown(false);
      return;
    }

    setSwitchingProvider(true);
    try {
      const res = await fetch('/api/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerName }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => prev ? { ...prev, provider: data.provider, displayName: data.displayName } : prev);
        onProviderChange?.(data.provider);
      }
    } catch (err) {
      console.error('[Config] Provider switch failed:', err);
    } finally {
      setSwitchingProvider(false);
      setShowProviderDropdown(false);
    }
  };

  if (!config) return null;

  return (
    <div className="flex items-center gap-2">
      {/* ─── 1. Multiple LLMs: Provider Dropdown ─── */}
      <div ref={providerDropdownRef} className="relative">
        <button
          onClick={() => {
            setShowProviderDropdown(!showProviderDropdown);
            setShowStrategyDropdown(false);
          }}
          disabled={switchingProvider}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-[var(--border-subtle)] hover:border-[var(--accent)]/20 hover:bg-[var(--accent-surface)] transition-all text-left"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {switchingProvider ? 'switching...' : config.displayName.toLowerCase()}
          </span>
          <svg
            width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
            className={`transition-transform duration-200 ${showProviderDropdown ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Provider Dropdown */}
        {showProviderDropdown && config.availableProviders && (
          <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in-fast">
            <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-widest font-mono">
                llm provider
              </span>
            </div>
            <div className="py-1">
              {config.availableProviders.map((p: ProviderInfo) => {
                const isSelected = p.name === config.provider;
                return (
                  <button
                    key={p.name}
                    onClick={() => handleProviderSwitch(p.name)}
                    className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'text-[var(--accent)] bg-[var(--accent-surface)]'
                        : 'text-[var(--text-secondary)] hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span>{p.displayName.toLowerCase()}</span>
                        {p.healthy && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" title="Online" />
                        )}
                      </div>
                      <span className="text-[9px] text-[var(--text-muted)] font-mono">
                        {p.configured ? (p.healthy ? 'ready' : 'standby') : 'needs api key'}
                      </span>
                    </div>
                    {isSelected && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. Multiple Strategies: Strategy Dropdown ─── */}
      <div ref={strategyDropdownRef} className="relative">
        <button
          onClick={() => {
            setShowStrategyDropdown(!showStrategyDropdown);
            setShowProviderDropdown(false);
          }}
          disabled={switchingStrategy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-[var(--border-subtle)] hover:border-[var(--accent)]/20 hover:bg-[var(--accent-surface)] transition-all text-left"
          title="Switch Context Management Strategy"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 2v10l7 4" />
          </svg>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {switchingStrategy ? 'switching...' : getStrategyDisplayName(config.strategy)}
          </span>
          <svg
            width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
            className={`transition-transform duration-200 ${showStrategyDropdown ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Strategy Dropdown */}
        {showStrategyDropdown && config.availableStrategies && (
          <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in-fast">
            <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-widest font-mono">
                context strategy
              </span>
            </div>
            <div className="py-1">
              {config.availableStrategies.map((strat) => {
                const isSelected = strat === config.strategy;
                return (
                  <button
                    key={strat}
                    onClick={() => handleStrategySwitch(strat)}
                    className={`w-full text-left px-3 py-2 text-[11px] transition-colors ${
                      isSelected
                        ? 'text-[var(--accent)] bg-[var(--accent-surface)]'
                        : 'text-[var(--text-secondary)] hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-mono">{getStrategyDisplayName(strat)}</span>
                        <span className="text-[9px] text-[var(--text-muted)] font-mono">
                          {strat === 'selective_summarization'
                            ? 'blueprint & entity extraction'
                            : strat === 'recursive_summarization'
                              ? 'incremental summarization'
                              : 'fixed-size recent buffer'}
                        </span>
                      </div>
                      {isSelected && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
