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
    case 'recursive_summarization': return 'recursive summarization';
    case 'sliding_window': return 'sliding window';
    case 'selective_summarization': return 'selective semantic';
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
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 2v10l7 4" />
          </svg>
          <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest font-mono">
            context
          </span>

          {/* Context Hit Status Badge */}
          {metrics.contextHit ? (
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-[var(--success)]/10 text-[var(--success)] font-mono border border-[var(--success)]/20">
              <span className="w-1 h-1 rounded-full bg-[var(--success)] animate-pulse" />
              hit
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-muted)] border border-white/8 font-mono">
              fresh
            </span>
          )}

          {/* Summarisation / Compression Badge */}
          {metrics.wasCompressed && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--accent-surface)] text-[var(--accent)] font-mono border border-[var(--accent)]/20">
              {compressionRatio ? `${compressionRatio}x` : 'summarized'}
            </span>
          )}
        </div>

        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
          className={`transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="context-panel-enter px-3 pb-3">
          <div className="bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-subtle)] p-3 space-y-3">
            
            {/* Strategy header */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)] font-mono">strategy:</span>
                <span className="text-[10px] font-medium text-[var(--accent)] font-mono">
                  {getStrategyDisplayName(currentStrategy)}
                </span>
              </div>
              <span className="text-[9px] text-[var(--text-muted)] font-mono">
                turn {metrics.turnCount || 1}
              </span>
            </div>

            {/* ─── Context Hit Detail Card ─── */}
            <div className="p-2.5 rounded bg-white/[0.015] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5 font-mono">
                  context status
                </span>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                  metrics.contextHit
                    ? 'bg-[var(--success)]/8 text-[var(--success)] border border-[var(--success)]/15'
                    : 'bg-white/5 text-[var(--text-muted)]'
                }`}>
                  {metrics.contextHit ? 'memory retrieved' : 'initial seed'}
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed font-mono">
                {metrics.contextHit
                  ? (metrics.thresholdHit
                      ? 'threshold reached — history compacted into semantic memory.'
                      : 'conversation history injected from memory buffer.')
                  : 'new conversation buffer. no compaction required yet.'}
              </p>
            </div>

            {/* Token Metrics Grid */}
            <div className="space-y-1.5 text-[11px] font-mono">
              {metrics.previousTokens !== undefined && metrics.previousTokens > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)]">uncompressed</span>
                  <span className="text-[var(--text-secondary)]">
                    {formatTokens(metrics.previousTokens)} tokens
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)]">managed context</span>
                <span className="text-[var(--success)] font-medium">
                  {formatTokens(metrics.totalTokens)} tokens
                </span>
              </div>

              {compressionRatio && metrics.wasCompressed && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)]">compression</span>
                  <span className="text-[var(--accent)] font-medium">
                    {compressionRatio}x ({Math.round((1 - metrics.totalTokens / (metrics.previousTokens || 1)) * 100)}% saved)
                  </span>
                </div>
              )}

              {metrics.summaryTokens > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)]">summary footprint</span>
                  <span className="text-[var(--text-secondary)]">
                    {formatTokens(metrics.summaryTokens)} tokens
                  </span>
                </div>
              )}
            </div>

            {/* ─── Summarisation Text Viewer (Feature 3) ─── */}
            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] font-mono">
                    summary content
                  </span>
                  {hasSummary && (
                    <span className="text-[9px] text-[var(--accent)] font-mono">
                      ({formatTokens(metrics.summaryTokens)} tokens)
                    </span>
                  )}
                </div>

                {hasSummary && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopySummary}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/8 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors font-mono"
                    >
                      {copied ? 'copied!' : 'copy'}
                    </button>
                    <button
                      onClick={() => setShowSummaryText(!showSummaryText)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--accent-surface)] hover:bg-[var(--accent)]/15 text-[var(--accent)] transition-colors font-mono"
                    >
                      {showSummaryText ? 'hide' : 'view'}
                    </button>
                  </div>
                )}
              </div>

              {hasSummary ? (
                showSummaryText && (
                  <div className="mt-2 p-2.5 rounded bg-[var(--bg-primary)] border border-[var(--accent)]/10 text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap select-text animate-fade-in">
                    {metrics.summaryContent}
                  </div>
                )
              ) : (
                <p className="mt-1 text-[10px] text-[var(--text-muted)] italic font-mono">
                  no summarisation triggered yet (within {metrics.maxTokens} token threshold).
                </p>
              )}
            </div>

            {/* Utilization Bar */}
            <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)] font-mono">context budget</span>
                <span className={`text-[10px] font-mono font-medium ${
                  utilizationPercent > 90 ? 'text-[var(--error)]' :
                  utilizationPercent > 70 ? 'text-[var(--warning)]' :
                  'text-[var(--success)]'
                }`}>
                  {metrics.utilization} ({formatTokens(metrics.totalTokens)}/{formatTokens(metrics.maxTokens)})
                </span>
              </div>
              <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    utilizationPercent > 90 ? 'bg-[var(--error)]' :
                    utilizationPercent > 70 ? 'bg-[var(--warning)]' :
                    'bg-[var(--accent)]'
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
