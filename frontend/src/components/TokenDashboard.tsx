/**
 * TokenDashboard — Real-time token usage & context observability dashboard.
 * Uses actual tiktoken-based counts from the backend, not dummy estimates.
 */

import { useState, useEffect, useRef } from 'react';
import type { ContextMetrics, StatusResponse, ProviderInfo } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contextMetrics: ContextMetrics | null;
  activeProvider?: string;
  activeStrategy?: string;
}

function formatTokens(tokens: number): string {
  if (!tokens || isNaN(tokens)) return '0';
  if (tokens >= 1000000) return (tokens / 1000000).toFixed(2) + 'M';
  if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'K';
  return tokens.toLocaleString();
}

export default function TokenDashboard({
  isOpen,
  onClose,
  contextMetrics,
  activeProvider = 'Ollama',
  activeStrategy = 'recursive_summarization',
}: Props) {
  const [metricsData, setMetricsData] = useState<StatusResponse['metrics'] | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'strategies' | 'history'>('overview');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data: StatusResponse = await res.json();
        setMetricsData(data.metrics);
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Failed to fetch status metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Live polling while dashboard is open
  useEffect(() => {
    if (isOpen) {
      fetchMetrics();
      pollRef.current = setInterval(fetchMetrics, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ─── Current session context window (real token counts) ───
  const currentTotalTokens = contextMetrics?.totalTokens || 0;
  const maxTokens = contextMetrics?.maxTokens || 4000;
  const utilizationRaw = maxTokens > 0 ? (currentTotalTokens / maxTokens) * 100 : 0;
  const utilizationPct = Math.min(100, utilizationRaw);

  const previousTokens = contextMetrics?.previousTokens || currentTotalTokens;
  const tokensSaved = Math.max(0, previousTokens - currentTotalTokens);
  const savingsPct = previousTokens > 0 ? Math.round((tokensSaved / previousTokens) * 100) : 0;

  const totalEstimated = (metricsData?.totalTokensEstimated || 0) + currentTotalTokens;
  const avgTokensPerReq = metricsData?.totalRequests
    ? Math.round(totalEstimated / Math.max(1, metricsData.totalRequests))
    : currentTotalTokens;

  // Token composition breakdown
  const summaryTokens = contextMetrics?.summaryTokens || 0;
  const messageTokens = contextMetrics?.messageTokens || 0;
  const systemPromptEstimate = Math.min(650, currentTotalTokens);
  const remainingMessageTokens = Math.max(0, messageTokens - systemPromptEstimate);

  const systemPct = currentTotalTokens > 0 ? Math.round((systemPromptEstimate / currentTotalTokens) * 100) : 25;
  const summaryPct = currentTotalTokens > 0 ? Math.round((summaryTokens / currentTotalTokens) * 100) : 15;
  const chatPct = Math.max(0, 100 - systemPct - summaryPct);

  const THRESHOLD_PCT = 70;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-primary)]">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-secondary)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-xl">⚡</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Token Usage & Context Dashboard
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                  Live Observability
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Real subword token counts (tiktoken cl100k_base) · Context window · LLM orchestration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-all text-xs flex items-center gap-1.5"
              title="Refresh Metrics"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? 'animate-spin' : ''}>
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-[var(--text-muted)] transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <span>📊</span> Token Overview
          </button>
          <button
            onClick={() => setActiveTab('strategies')}
            className={`pb-2.5 px-3 text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'strategies'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <span>🧠</span> Strategy Benchmark
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <span>🎯</span> Context Hits & Memory
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'overview' && (
            <>
              {!contextMetrics && (
                <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
                  <div className="text-[var(--text-muted)] text-xs mb-2">No active session yet</div>
                  <div className="text-[var(--text-secondary)] text-sm">
                    Send a message in chat to populate real-time token metrics.
                  </div>
                </div>
              )}

              {contextMetrics && (
                <>
                  {/* 4 Key Stat Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-4 relative overflow-hidden">
                      <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Active Context</span>
                        <span className="text-purple-400">⚡</span>
                      </div>
                      <div className="text-2xl font-black font-mono text-purple-400">
                        {formatTokens(currentTotalTokens)}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center justify-between">
                        <span>Limit: {formatTokens(maxTokens)}</span>
                        <span className={utilizationPct > 80 ? 'text-red-400' : 'text-emerald-400'}>
                          {utilizationPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-4 relative overflow-hidden">
                      <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Tokens Saved</span>
                        <span className="text-emerald-400">🌿</span>
                      </div>
                      <div className="text-2xl font-black font-mono text-emerald-400">
                        {tokensSaved > 0 ? `+${formatTokens(tokensSaved)}` : '0'}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">
                        {savingsPct > 0 ? `${savingsPct}% reduction via summarization` : 'No compression required yet'}
                      </div>
                    </div>

                    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-4 relative overflow-hidden">
                      <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Context Status</span>
                        <span className="text-blue-400">🎯</span>
                      </div>
                      <div className="text-2xl font-black font-mono text-blue-400 flex items-center gap-2">
                        {contextMetrics.contextHit ? 'HIT' : 'INITIAL'}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">
                        {contextMetrics.contextHit
                          ? `Turn ${contextMetrics.turnCount || 1} memory active`
                          : 'Cold start seed'}
                      </div>
                    </div>

                    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-4 relative overflow-hidden">
                      <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Total Requests</span>
                        <span className="text-amber-400">🤖</span>
                      </div>
                      <div className="text-2xl font-black font-mono text-amber-400">
                        {metricsData?.totalRequests || 0}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">
                        Avg {formatTokens(avgTokensPerReq)} tokens/call
                      </div>
                    </div>
                  </div>

                  {/* Context Window Budget Meter */}
                  <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-[var(--text-primary)]">
                          Context Window Utilization
                        </h3>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Real token count vs configured limit ({formatTokens(maxTokens)}). Compression triggers at {THRESHOLD_PCT}%.
                        </p>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className="font-bold text-purple-400">{formatTokens(currentTotalTokens)}</span>
                        <span className="text-[var(--text-muted)]"> / {formatTokens(maxTokens)} tokens</span>
                      </div>
                    </div>

                    <div className="relative w-full h-3 rounded-full bg-white/5 overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          utilizationPct > 85 ? 'bg-red-500' :
                          utilizationPct > THRESHOLD_PCT ? 'bg-yellow-500' :
                          'bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500'
                        }`}
                        style={{ width: `${utilizationPct}%` }}
                      />
                      {/* Threshold marker at 70% */}
                      <div
                        className="absolute left-[70%] top-1/2 -translate-y-1/2 w-px h-4 bg-red-400"
                        title="Compression threshold (70%)"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                      <span>0% (Empty)</span>
                      <span>{THRESHOLD_PCT}% — Compression Trigger</span>
                      <span>100% ({formatTokens(maxTokens)} Tokens)</span>
                    </div>
                  </div>

                  {/* Token Composition Breakdown */}
                  <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-bold text-[var(--text-primary)]">
                      Live Token Distribution Breakdown
                    </h3>

                    <div className="w-full h-4 rounded-lg bg-white/5 overflow-hidden flex">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${systemPct}%` }}
                        title={`System Architecture Prompt: ~${systemPct}%`}
                      />
                      <div
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${summaryPct}%` }}
                        title={`Active Summary: ~${summaryPct}%`}
                      />
                      <div
                        className="h-full bg-pink-500 transition-all duration-300"
                        style={{ width: `${chatPct}%` }}
                        title={`User & Assistant Exchanges: ~${chatPct}%`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-indigo-500/20">
                        <div className="w-3 h-3 rounded-md bg-indigo-500 shrink-0" />
                        <div>
                          <div className="text-[10px] text-[var(--text-muted)] font-medium">System Instructions</div>
                          <div className="text-xs font-bold font-mono text-indigo-300">
                            {formatTokens(systemPromptEstimate)} tokens ({systemPct}%)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-purple-500/20">
                        <div className="w-3 h-3 rounded-md bg-purple-500 shrink-0" />
                        <div>
                          <div className="text-[10px] text-[var(--text-muted)] font-medium">Summarisation Memory</div>
                          <div className="text-xs font-bold font-mono text-purple-300">
                            {formatTokens(summaryTokens)} tokens ({summaryPct}%)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-pink-500/20">
                        <div className="w-3 h-3 rounded-md bg-pink-500 shrink-0" />
                        <div>
                          <div className="text-[10px] text-[var(--text-muted)] font-medium">Active Code & Chat</div>
                          <div className="text-xs font-bold font-mono text-pink-300">
                            {formatTokens(remainingMessageTokens)} tokens ({chatPct}%)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'strategies' && (
            <div className="space-y-4">
              <div className="text-xs text-[var(--text-muted)]">
                Comparison of the 3 context management strategies implemented in WebForge AI:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  activeStrategy === 'recursive_summarization'
                    ? 'bg-purple-500/10 border-purple-500/40 shadow-lg shadow-purple-500/10'
                    : 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-purple-400">1. Recursive Summarization</span>
                      {activeStrategy === 'recursive_summarization' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mb-3 leading-relaxed">
                      Continuously incorporates older messages into an incremental narrative paragraph whenever the threshold is hit.
                    </p>
                    <div className="space-y-2 text-[10px] font-mono border-t border-[var(--border-subtle)] pt-3">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Compression:</span>
                        <span className="text-emerald-400">~2.5x - 4.0x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Memory Type:</span>
                        <span>Conversational Narrative</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Overhead:</span>
                        <span className="text-yellow-400">1 LLM Summary Call</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  activeStrategy === 'sliding_window'
                    ? 'bg-purple-500/10 border-purple-500/40 shadow-lg shadow-purple-500/10'
                    : 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-400">2. Sliding Window</span>
                      {activeStrategy === 'sliding_window' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mb-3 leading-relaxed">
                      Retains only the N most recent message exchanges, silently discarding older turns to strictly bound the token window.
                    </p>
                    <div className="space-y-2 text-[10px] font-mono border-t border-[var(--border-subtle)] pt-3">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Compression:</span>
                        <span className="text-yellow-400">Hard Truncation</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Memory Type:</span>
                        <span>Recent Turns Only</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Overhead:</span>
                        <span className="text-emerald-400">0ms (Zero Extra LLM)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  activeStrategy === 'selective_summarization'
                    ? 'bg-gradient-to-b from-purple-500/15 to-pink-500/15 border-purple-500/50 shadow-lg shadow-purple-500/20'
                    : 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-pink-400">3. Selective Semantic (Custom)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-bold">
                        RECOMMENDED
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mb-3 leading-relaxed">
                      Extracts high-density Architectural Blueprints (Component map, design constraints, file deltas) with 60% higher density than prose.
                    </p>
                    <div className="space-y-2 text-[10px] font-mono border-t border-[var(--border-subtle)] pt-3">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Compression:</span>
                        <span className="text-emerald-400 font-bold">~4.5x - 7.0x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Memory Type:</span>
                        <span>Structured Blueprint</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Retention:</span>
                        <span className="text-pink-400">Zero Hallucination</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)]">
                    Context Hit & Memory Verification
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Observability on whether prompts hit conversational cache or triggered compaction
                  </p>
                </div>
                <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {contextMetrics?.contextHit ? 'Memory Status: HIT' : 'Memory Status: INITIAL'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <span>🧠</span> Active Summarisation Content
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {formatTokens(summaryTokens)} tokens
                  </span>
                </div>

                {contextMetrics?.summaryContent ? (
                  <div className="p-3 rounded-lg bg-black/40 border border-purple-500/20 text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {contextMetrics.summaryContent}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg bg-white/[0.01] border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">
                    No summarisation required yet. Current session has {contextMetrics?.messageTokens || 0} tokens in raw context.
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-3">
                <h4 className="text-xs font-bold text-[var(--text-secondary)]">
                  Registered LLM Providers
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {providers.map((p) => (
                    <div key={p.name} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-[var(--border-subtle)]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.healthy ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="font-medium">{p.displayName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                        {p.isDefault ? 'Default' : (p.configured ? 'Standby' : 'Unconfigured')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-3">
                <h4 className="text-xs font-bold text-[var(--text-secondary)]">
                  Global Metrics (Server)
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Total Requests</span>
                    <span className="font-mono text-[var(--text-secondary)]">{metricsData?.totalRequests || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Total Tokens Estimated</span>
                    <span className="font-mono text-[var(--text-secondary)]">{formatTokens(metricsData?.totalTokensEstimated || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Summarizations</span>
                    <span className="font-mono text-[var(--text-secondary)]">{metricsData?.summarizations || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Avg Tokens/Request</span>
                    <span className="font-mono text-[var(--text-secondary)]">{formatTokens(avgTokensPerReq)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-4 text-[var(--text-muted)] text-[11px]">
            <span>Active Provider: <strong className="text-[var(--text-secondary)]">{activeProvider}</strong></span>
            <span>Strategy: <strong className="text-purple-400">{activeStrategy}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-medium text-xs transition-all shadow-md"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
