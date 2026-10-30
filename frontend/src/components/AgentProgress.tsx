/**
 * AgentProgress — Step-based progress indicator for the agent pipeline.
 * Shows real-time steps driven by WebSocket 'agent_progress' events.
 * Replaces the simple TypingIndicator with a visual pipeline.
 */

import type { AgentStep, AgentProgressState } from '../types';

const STEP_CONFIG: { name: AgentStep['name']; label: string; icon: string }[] = [
  { name: 'understanding', label: 'understanding request', icon: '💬' },
  { name: 'context',       label: 'managing context',     icon: '🧠' },
  { name: 'planning',      label: 'planning website',     icon: '📐' },
  { name: 'generating',    label: 'generating code',      icon: '⚡' },
  { name: 'validating',    label: 'validating & fixing',  icon: '🛡️' },
  { name: 'building',      label: 'updating sandbox',     icon: '🔨' },
  { name: 'complete',      label: 'completed',            icon: '✨' },
];

interface Props {
  progress: AgentProgressState;
}

export default function AgentProgress({ progress }: Props) {
  if (!progress.isActive && progress.steps.every(s => s.status === 'pending')) {
    // Fallback: simple thinking indicator
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg rounded-bl-sm px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] typing-dot" />
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] typing-dot" />
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] typing-dot" />
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">thinking...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg rounded-bl-sm px-4 py-3 min-w-[220px]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-[10px] font-medium text-[var(--accent)] uppercase tracking-widest font-mono">
            pipeline
          </span>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-1.5">
          {STEP_CONFIG.map((stepCfg) => {
            const step = progress.steps.find(s => s.name === stepCfg.name);
            const status = step?.status || 'pending';

            return (
              <div
                key={stepCfg.name}
                className={`flex items-center gap-2.5 py-1 px-2 rounded transition-all duration-300 ${
                  status === 'active'
                    ? 'bg-[var(--accent-surface)] border border-[var(--accent)]/15'
                    : status === 'complete'
                      ? 'opacity-70'
                      : status === 'error'
                        ? 'bg-[var(--error)]/8 border border-[var(--error)]/15'
                        : 'opacity-35'
                }`}
              >
                {/* Status icon */}
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  {status === 'complete' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : status === 'active' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" className="progress-spinner">
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                  ) : status === 'error' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-white/15" />
                  )}
                </div>

                {/* Label */}
                <span className={`text-[10px] leading-none font-mono ${
                  status === 'active'
                    ? 'text-[var(--accent)]'
                    : status === 'complete'
                      ? 'text-[var(--success)]/70'
                      : status === 'error'
                        ? 'text-[var(--error)]'
                        : 'text-[var(--text-muted)]'
                }`}>
                  {stepCfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
