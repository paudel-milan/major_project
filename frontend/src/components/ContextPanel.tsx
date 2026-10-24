/**
 * ContextPanel — Expandable panel showing context management metrics.
 * Implements Feature 3: "Show context hit and summarisation".
 * Displays real data from contextMetrics:
 *   - Context Hit status & indicator (Active / Threshold / Cold start)
 *   - Real generated Summarisation text viewer with copy support
 *   - Strategy metrics for RecursiveSummarization, SlidingWindow, and SelectiveSummarization
 */

import { useState } from 'react';
import type { ContextMetrics } from '../types';

interface Props {
  metrics: ContextMetrics | null;
  strategy: string;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K';
  }
  return tokens.toString();
}

function getStrategyDisplayName(strategy: string): string {
  switch (strategy) {
    case 'recursive_summarization': return 'Recursive Summarization';
    case 'sliding_window': return 'Sliding Window';
    case 'selective_summarization': return 'Selective Semantic (Custom)';
    default: return strategy;
  }
}

export default function ContextPanel({ metrics, strategy }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSummaryText, setShowSummaryText] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!metrics) return null;

  const currentStrategy = strategy || metrics.strategy || 'recursive_summarization';

  const compressionRatio = metrics.previousTokens && metrics.previousTokens > 0 && metrics.totalTokens > 0
    ? (metrics.previousTokens / metrics.totalTokens).toFixed(1)
    : null;

  const utilizationPercent = parseFloat(metrics.utilization || '0');
  const hasSummary = !!(metrics.summaryContent && metrics.summaryContent.trim().length > 0);

  const handleCopySummary = () => {
    if (metrics.summaryContent) {
      navigator.clipboard.writeText(metrics.summaryContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border-t border-[var(--border-subtle)]">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px]">🧠</span>
          <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Context Manager
          </span>

          {/* Context Hit Status Badge */}
          {metrics.contextHit ? (
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/30">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              Context Hit: Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-[var(--text-muted)] border border-white/10">
              Fresh Context
            </span>
          )}

          {/* Summarisation / Compression Badge */}
          {metrics.wasCompressed && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium border border-purple-500/30">
              Summarized ({compressionRatio ? `${compressionRatio}x` : 'Active'})
            </span>
          )}
        </div>

        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
          className={`transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="context-panel-enter px-3 pb-3">
          <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border-subtle)] p-3 space-y-3">
            
            {/* Strategy header */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)]">Active Strategy:</span>
                <span className="text-[11px] font-medium text-purple-400">
                  {getStrategyDisplayName(currentStrategy)}
                </span>
              </div>
              <span className="text-[9px] text-[var(--text-muted)] font-mono">
                Turn {metrics.turnCount || 1}
              </span>
            </div>

            {/* ─── Context Hit Detail Card ─── */}
            <div className="p-2.5 rounded-md bg-white/[0.02] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                  <span>🎯</span> Context Hit Status
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  metrics.contextHit
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-white/5 text-[var(--text-muted)]'
                }`}>
                  {metrics.contextHit ? 'Memory Retrieved (HIT)' : 'Initial Seed (MISS)'}
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                {metrics.contextHit
                  ? (metrics.thresholdHit
                      ? 'Threshold reached: Historical turns were compacted into semantic memory to maintain precision.'
                      : 'Conversation history was successfully injected from memory buffer into the LLM context.')
                  : 'Starting a new conversation buffer. No historical compaction required yet.'}
              </p>
            </div>

            {/* Token Metrics Grid */}
            <div className="space-y-1.5 text-[11px]">
              {metrics.previousTokens !== undefined && metrics.previousTokens > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)]">Uncompressed Tokens</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {formatTokens(metrics.previousTokens)} tokens
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)]">Managed Context</span>
                <span className="font-mono text-emerald-400 font-medium">
                  {formatTokens(metrics.totalTokens)} tokens
                </span>
              </div>

              {compressionRatio && metrics.wasCompressed && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)]">Compression Efficiency</span>
                  <span className="font-mono text-purple-400 font-semibold">
                    {compressionRatio}x ({Math.round((1 - metrics.totalTokens / (metrics.previousTokens || 1)) * 100)}% saved)
                  </span>
                </div>
              )}

              {metrics.summaryTokens > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)]">Summary Footprint</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {formatTokens(metrics.summaryTokens)} tokens
                  </span>
                </div>
              )}
            </div>

            {/* ─── Summarisation Text Viewer (Feature 3) ─── */}
            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
                    📝 Summarisation Content
                  </span>
                  {hasSummary && (
                    <span className="text-[9px] text-purple-400 font-mono">
                      ({formatTokens(metrics.summaryTokens)} tokens)
                    </span>
                  )}
                </div>

                {hasSummary && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopySummary}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => setShowSummaryText(!showSummaryText)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 transition-colors"
                    >
                      {showSummaryText ? 'Hide' : 'View'}
                    </button>
                  </div>
                )}
              </div>

              {hasSummary ? (
                showSummaryText && (
                  <div className="mt-2 p-2.5 rounded bg-black/40 border border-purple-500/20 text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap select-text animate-fade-in">
                    {metrics.summaryContent}
                  </div>
                )
              ) : (
                <p className="mt-1 text-[10px] text-[var(--text-muted)] italic">
                  No summarisation triggered yet (conversation is within the {metrics.maxTokens} token threshold).
                </p>
              )}
            </div>

            {/* Utilization Bar */}
            <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)]">Context Window Budget</span>
                <span className={`text-[10px] font-mono font-medium ${
                  utilizationPercent > 90 ? 'text-red-400' :
                  utilizationPercent > 70 ? 'text-yellow-400' :
                  'text-emerald-400'
                }`}>
                  {metrics.utilization} ({formatTokens(metrics.totalTokens)} / {formatTokens(metrics.maxTokens)})
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    utilizationPercent > 90 ? 'bg-red-500' :
                    utilizationPercent > 70 ? 'bg-yellow-500' :
                    'bg-gradient-to-r from-purple-500 to-pink-500'
                  }`}
                  style={{ width: `${Math.min(100, utilizationPercent)}%` }}
                />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
