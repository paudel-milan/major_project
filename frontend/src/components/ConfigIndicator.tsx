/**
 * ConfigIndicator — Interactive LLM Provider + Context Strategy controller.
 * Fetches from /api/config and allows runtime switching for both Multiple LLMs
 * and Multiple Context Strategies (including our custom Selective Summarization).
 */

import { useState, useEffect, useRef } from 'react';
import type { ConfigInfo, ProviderInfo } from '../types';

function getStrategyDisplayName(strategy: string): string {
  switch (strategy) {
    case 'recursive_summarization': return 'Recursive Summarization';
    case 'sliding_window': return 'Sliding Window';
    case 'selective_summarization': return 'Selective Semantic (Custom)';
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
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-[var(--border-subtle)] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left"
          title="Switch active LLM provider"
        >
          <span className="text-[10px]">🤖</span>
          <span className="text-[10px] font-medium text-[var(--text-secondary)]">
            {switchingProvider ? 'Switching LLM...' : config.displayName}
          </span>
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
            className={`transition-transform duration-200 ${showProviderDropdown ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Provider Dropdown */}
        {showProviderDropdown && config.availableProviders && (
          <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
            <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Select LLM Provider
              </span>
              <span className="text-[9px] text-blue-400 font-mono">4 Registered</span>
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
                        ? 'text-blue-400 bg-blue-500/10 font-medium'
                        : 'text-[var(--text-secondary)] hover:bg-white/5'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span>{p.displayName}</span>
                        {p.healthy && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Online" />
                        )}
                      </div>
                      <span className="text-[9px] text-[var(--text-muted)] capitalize">
                        {p.configured ? (p.healthy ? 'Ready & Healthy' : 'Configured (Standby)') : 'Requires API Key'}
                      </span>
                    </div>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-[var(--border-subtle)] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all text-left"
          title="Switch Context Management Strategy"
        >
          <span className="text-[10px]">🧠</span>
          <span className="text-[10px] font-medium text-[var(--text-secondary)]">
            {switchingStrategy ? 'Switching...' : getStrategyDisplayName(config.strategy)}
          </span>
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
            className={`transition-transform duration-200 ${showStrategyDropdown ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Strategy Dropdown */}
        {showStrategyDropdown && config.availableStrategies && (
          <div className="absolute top-full left-0 mt-1 min-w-[240px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
            <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Context Strategy
              </span>
              <span className="text-[9px] text-purple-400 font-mono">3 Strategies</span>
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
                        ? 'text-purple-400 bg-purple-500/10 font-medium'
                        : 'text-[var(--text-secondary)] hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span>{getStrategyDisplayName(strat)}</span>
                        <span className="text-[9px] text-[var(--text-muted)]">
                          {strat === 'selective_summarization'
                            ? 'Architectural blueprint & entity extraction'
                            : strat === 'recursive_summarization'
                              ? 'Incremental conversational summarization'
                              : 'Fixed-size FIFO recent message buffer'}
                        </span>
                      </div>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
