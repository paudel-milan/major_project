import { useState, useCallback } from 'react';
import type { ChatMessage, AgentResponse, ContextMetrics } from '../types';

const API_BASE = '/api';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextMetrics, setContextMetrics] = useState<ContextMetrics | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string, provider?: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          sessionId,
          provider,
        }),
      });

      const data: AgentResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Request failed');
      }

      // Update session/project IDs
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.projectId) setProjectId(data.projectId);
      if (data.provider) setLastProvider(data.provider);
      if (data.contextMetrics) setContextMetrics(data.contextMetrics);

      // Add AI message
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.description || 'Files updated successfully.',
        timestamp: Date.now(),
        files: data.updatedFiles,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errMsg);

      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${errMsg}`,
        timestamp: Date.now(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setProjectId(null);
    setError(null);
    setContextMetrics(null);
    setLastProvider(null);
  }, []);

  return {
    messages,
    isLoading,
    sessionId,
    projectId,
    error,
    contextMetrics,
    lastProvider,
    sendMessage,
    clearChat,
  };
}

