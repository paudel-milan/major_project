import { useState, useEffect, useRef, useCallback } from 'react';
import type { WSEvent, BuildStatus, AgentStep } from '../types';

const WS_URL = `ws://${window.location.host}/ws`;

/** Mapping from WS event name → human-readable step label */
const STEP_LABELS: Record<string, string> = {
  ai_thinking: 'Analyzing your request…',
  ai_generating: 'Generating code with AI…',
  build_start: 'Building your website…',
  build_progress: 'Compiling project files…',
  build_complete: 'Build complete ✓',
  build_error: 'Build encountered an error',
  reload: 'Refreshing preview…',
  context_compressed: 'Optimizing conversation context…',
  error: 'Something went wrong',
};

/** Ordered pipeline stages used to render the implementation plan */
const PIPELINE_STAGES = [
  { event: 'ai_thinking', label: 'Analyzing request' },
  { event: 'ai_generating', label: 'Generating code' },
  { event: 'build_start', label: 'Building project' },
  { event: 'build_complete', label: 'Finalizing preview' },
];

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [buildStatus, setBuildStatus] = useState<BuildStatus>({ status: 'idle' });
  const [shouldReload, setShouldReload] = useState(0);

  /** Live agent step currently in progress */
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  /** Current status text shown in the chat typing area */
  const [agentStatusText, setAgentStatusText] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const listenersRef = useRef<Map<string, Set<(data: Record<string, unknown>) => void>>>(new Map());

  /** Reset steps for a new generation cycle */
  const resetSteps = useCallback(() => {
    setAgentSteps(
      PIPELINE_STAGES.map((s) => ({
        id: s.event,
        label: s.label,
        status: 'pending' as const,
      }))
    );
    setAgentStatusText(null);
  }, []);

  /** Mark a stage as active (and all prior stages as done) */
  const advanceToStage = useCallback((eventName: string) => {
    setAgentSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === eventName);
      if (idx === -1) return prev;
      return prev.map((s, i) => ({
        ...s,
        status: i < idx ? 'done' : i === idx ? 'active' : s.status,
        timestamp: i <= idx ? Date.now() : s.timestamp,
      }));
    });
  }, []);

  /** Mark all stages as done */
  const completeAllSteps = useCallback(() => {
    setAgentSteps((prev) =>
      prev.map((s) => ({ ...s, status: 'done' as const, timestamp: s.timestamp || Date.now() }))
    );
  }, []);

  /** Mark final stage as error */
  const failSteps = useCallback((errorMsg?: string) => {
    setAgentSteps((prev) => {
      const activeIdx = prev.findIndex((s) => s.status === 'active');
      const failIdx = activeIdx >= 0 ? activeIdx : prev.length - 1;
      return prev.map((s, i) => ({
        ...s,
        status: i === failIdx ? 'error' : s.status,
        detail: i === failIdx ? errorMsg : s.detail,
      }));
    });
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[WS] Connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSEvent = JSON.parse(event.data);

        // Update the live status label
        if (STEP_LABELS[msg.event]) {
          setAgentStatusText(STEP_LABELS[msg.event]);
        }

        // Handle build events
        switch (msg.event) {
          case 'ai_thinking':
            resetSteps();
            advanceToStage('ai_thinking');
            break;

          case 'ai_generating':
            advanceToStage('ai_generating');
            break;

          case 'build_start':
            setBuildStatus({ status: 'building', projectId: msg.data.projectId as string });
            advanceToStage('build_start');
            break;

          case 'build_complete':
            setBuildStatus({
              status: 'ready',
              projectId: msg.data.projectId as string,
              duration: msg.data.duration as number,
            });
            advanceToStage('build_complete');
            completeAllSteps();
            // Clear status after a short delay
            setTimeout(() => setAgentStatusText(null), 1500);
            break;

          case 'build_error':
            setBuildStatus({
              status: 'error',
              projectId: msg.data.projectId as string,
              error: msg.data.error as string,
            });
            failSteps(msg.data.error as string);
            break;

          case 'reload':
            setShouldReload(prev => prev + 1);
            break;

          case 'error':
            failSteps(msg.data.message as string);
            break;
        }

        // Notify registered listeners
        const listeners = listenersRef.current.get(msg.event);
        if (listeners) {
          listeners.forEach(fn => fn(msg.data));
        }
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('[WS] Disconnected, reconnecting in 3s...');
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [resetSteps, advanceToStage, completeAllSteps, failSteps]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const on = useCallback((event: string, handler: (data: Record<string, unknown>) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);
    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  return { isConnected, buildStatus, shouldReload, on, agentSteps, agentStatusText };
}
