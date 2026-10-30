import { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import MessageBubble from './MessageBubble';
import VoiceInput from './VoiceInput';
import AgentProgress from './AgentProgress';
import ContextPanel from './ContextPanel';
import type { AgentProgressState, ContextMetrics } from '../types';

interface Props {
  onProjectId?: (id: string) => void;
  agentProgress?: AgentProgressState;
  onContextMetricsChange?: (metrics: ContextMetrics) => void;
}

export default function ChatPanel({ onProjectId, agentProgress, onContextMetricsChange }: Props) {
  const { messages, isLoading, projectId, contextMetrics, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or loading progress
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, agentProgress]);

  // Notify parent of project ID changes
  useEffect(() => {
    if (projectId && onProjectId) onProjectId(projectId);
  }, [projectId, onProjectId]);

  // Notify parent of context metrics changes
  useEffect(() => {
    const active = contextMetrics || agentProgress?.contextMetrics;
    if (active && onContextMetricsChange) {
      onContextMetricsChange(active);
    }
  }, [contextMetrics, agentProgress?.contextMetrics, onContextMetricsChange]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  };

  const handleVoiceTranscript = (text: string) => {
    setInput(prev => (prev ? `${prev} ${text}` : text));
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight + 20, 150) + 'px';
    }
  };

  const isEmpty = messages.length === 0;

  // Determine current active strategy name
  const currentStrategy = agentProgress?.contextMetrics?.strategy || 'recursive_summarization';

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xs font-medium text-[var(--text-muted)] tracking-wide">chat</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors px-2 py-0.5 rounded hover:bg-[var(--accent-surface)] font-mono"
          >
            clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 animate-fade-in">
            <div className="w-14 h-14 rounded-xl bg-[var(--accent-surface)] border border-[var(--accent)]/15 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-medium text-[var(--text-primary)] mb-1.5">
                what would you like to build?
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-[280px] leading-relaxed">
                describe your website and I'll generate it in real-time. iterate with follow-up messages.
              </p>
            </div>
            {/* Quick prompts */}
            <div className="flex flex-col gap-2 w-full max-w-[300px] mt-1">
              {[
                'a modern portfolio with dark theme',
                'landing page for a SaaS product',
                'a restaurant website with menu',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  className="text-left text-[11px] text-[var(--text-muted)] px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] hover:border-[var(--accent)]/25 hover:text-[var(--text-secondary)] hover:bg-[var(--accent-surface)] transition-all font-mono-mt"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {(isLoading || agentProgress?.isActive) && (
              <AgentProgress progress={agentProgress || { isActive: isLoading, steps: [] }} />
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Context visibility panel */}
      {contextMetrics && (
        <ContextPanel metrics={contextMetrics} strategy={currentStrategy} />
      )}

      {/* Input area */}
      <div className="shrink-0 p-3 border-t border-[var(--border-subtle)]">
        <div className={`flex items-end gap-2 bg-[var(--bg-tertiary)] border rounded-lg px-3 py-2 transition-all mt-focus ${
          input ? 'border-[var(--accent)]/30' : 'border-[var(--border-subtle)]'
        }`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="describe your website..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none max-h-[150px] font-mono"
            disabled={isLoading}
          />
          
          {/* Voice Input Microphone Button */}
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={isLoading} />

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              input.trim() && !isLoading
                ? 'bg-[var(--accent)] text-[var(--bg-tertiary)] hover:brightness-110 active:scale-95'
                : 'bg-white/5 text-[var(--text-muted)]'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-[9px] text-[var(--text-muted)] text-center mt-1.5 font-mono">
          enter to send · shift+enter for new line · click mic to speak
        </p>
      </div>
    </div>
  );
}
