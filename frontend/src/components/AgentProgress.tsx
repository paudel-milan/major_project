/**
 * AgentProgress — Step-based progress indicator for the agent pipeline.
 * Shows real-time steps driven by WebSocket 'agent_progress' events.
 * Replaces the simple TypingIndicator with a visual pipeline.
 */

import type { AgentStep, AgentProgressState } from '../types';

const STEP_CONFIG: { name: AgentStep['name']; label: string; icon: string }[] = [
  { name: 'understanding', label: 'Understanding request', icon: '💬' },
  { name: 'context',       label: 'Managing context',     icon: '🧠' },
  { name: 'planning',      label: 'Planning website',     icon: '📐' },
  { name: 'generating',    label: 'Generating code',      icon: '⚡' },
  { name: 'validating',    label: 'Validating & fixing',  icon: '🛡️' },
  { name: 'building',      label: 'Updating sandbox',     icon: '🔨' },
  { name: 'complete',      label: 'Completed',            icon: '✨' },
];

interface Props {
  progress: AgentProgressState;
}

export default function AgentProgress({ progress }: Props) {
  if (!progress.isActive && progress.steps.every(s => s.status === 'pending')) {
    // Fallback: simple thinking indicator
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl rounded-bl-md px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-400 typing-dot" />
              <div className="w-2 h-2 rounded-full bg-purple-400 typing-dot" />
              <div className="w-2 h-2 rounded-full bg-purple-400 typing-dot" />
            </div>
            <span className="text-xs text-[var(--text-muted)]">AI is thinking...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl rounded-bl-md px-4 py-3 min-w-[240px]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
            Agent Pipeline
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
                className={`flex items-center gap-2.5 py-1 px-2 rounded-md transition-all duration-300 ${
                  status === 'active'
                    ? 'bg-purple-500/10 border border-purple-500/20'
                    : status === 'complete'
                      ? 'opacity-80'
                      : status === 'error'
                        ? 'bg-red-500/10 border border-red-500/20'
                        : 'opacity-40'
                }`}
              >
                {/* Status icon */}
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  {status === 'complete' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : status === 'active' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" className="progress-spinner">
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                  ) : status === 'error' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                  )}
                </div>

                {/* Label */}
                <span className={`text-[11px] leading-none ${
                  status === 'active'
                    ? 'text-purple-300 font-medium'
                    : status === 'complete'
                      ? 'text-emerald-400/80'
                      : status === 'error'
                        ? 'text-red-400'
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
