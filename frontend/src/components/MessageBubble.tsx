import type { ChatMessage, AgentStep } from '../types';

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-br-md'
          : isError
            ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-bl-md'
            : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-bl-md'
      }`}>
        {/* Message content */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>

        {/* Files list */}
        {message.files && message.files.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-300/70 mb-1.5">
              Files Updated
            </p>
            <div className="flex flex-wrap gap-1">
              {message.files.map((file) => (
                <span
                  key={file}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 text-[11px] font-mono"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {file.replace('src/', '')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-[9px] mt-1.5 ${isUser ? 'text-purple-200/50' : 'text-[var(--text-muted)]'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

/* ─── Live Typing Indicator with real-time status updates ─── */

interface TypingProps {
  statusText?: string | null;
  steps?: AgentStep[];
}

export function TypingIndicator({ statusText, steps }: TypingProps) {
  const hasSteps = steps && steps.length > 0;

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl rounded-bl-md px-4 py-3 max-w-[90%] w-full">
        {/* Pipeline steps */}
        {hasSteps && (
          <div className="flex flex-col gap-1.5 mb-2">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                {/* Step icon */}
                {step.status === 'done' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : step.status === 'active' ? (
                  <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
                  </div>
                ) : step.status === 'error' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                ) : (
                  <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]/30" />
                  </div>
                )}

                {/* Step label */}
                <span className={`text-xs leading-tight ${
                  step.status === 'done' ? 'text-emerald-400/80' :
                  step.status === 'active' ? 'text-[var(--text-primary)]' :
                  step.status === 'error' ? 'text-red-400' :
                  'text-[var(--text-muted)]/50'
                }`}>
                  {step.label}
                  {step.status === 'error' && step.detail && (
                    <span className="text-[10px] text-red-400/70 ml-1">— {step.detail}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Current status text */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-purple-400 typing-dot" />
            <div className="w-2 h-2 rounded-full bg-purple-400 typing-dot" />
            <div className="w-2 h-2 rounded-full bg-purple-400 typing-dot" />
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            {statusText || 'AI is thinking…'}
          </span>
        </div>
      </div>
    </div>
  );
}
