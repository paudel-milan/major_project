import { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import MessageBubble, { TypingIndicator } from './MessageBubble';

interface Props {
  onProjectId?: (id: string) => void;
}

export default function ChatPanel({ onProjectId }: Props) {
  const { messages, isLoading, projectId, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Notify parent of project ID changes
  useEffect(() => {
    if (projectId && onProjectId) onProjectId(projectId);
  }, [projectId, onProjectId]);

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

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Chat</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors px-2 py-0.5 rounded hover:bg-white/5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#iconGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
                What would you like to build?
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-[260px] leading-relaxed">
                Describe your website and I'll generate it in real-time. You can iterate with follow-up messages.
              </p>
            </div>
            {/* Quick prompts */}
            <div className="flex flex-col gap-2 w-full max-w-[280px] mt-2">
              {[
                'A modern portfolio with dark theme',
                'Landing page for a SaaS product',
                'A restaurant website with menu',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  className="text-left text-[11px] text-[var(--text-secondary)] px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 p-3 border-t border-[var(--border-subtle)]">
        <div className={`flex items-end gap-2 bg-[var(--bg-surface)] border rounded-xl px-3 py-2 transition-all ${
          input ? 'border-purple-500/40 shadow-[0_0_12px_var(--accent-glow)]' : 'border-[var(--border-subtle)]'
        }`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe your website..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none max-h-[150px]"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              input.trim() && !isLoading
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 active:scale-95'
                : 'bg-white/5 text-[var(--text-muted)]'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-[9px] text-[var(--text-muted)] text-center mt-1.5">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
