import { useState, useEffect, useRef, useCallback } from 'react';
import type { WSEvent, BuildStatus, AgentProgressState, AgentStep, AgentStepName } from '../types';

const WS_URL = `ws://${window.location.host}/ws`;

const DEFAULT_STEPS: AgentStep[] = [
  { name: 'understanding', label: 'Understanding request', status: 'pending' },
  { name: 'context',       label: 'Managing context',     status: 'pending' },
  { name: 'planning',      label: 'Planning website',     status: 'pending' },
  { name: 'generating',    label: 'Generating code',      status: 'pending' },
  { name: 'validating',    label: 'Validating code',      status: 'pending' },
  { name: 'building',      label: 'Updating sandbox',     status: 'pending' },
  { name: 'complete',      label: 'Completed',            status: 'pending' },
];

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [buildStatus, setBuildStatus] = useState<BuildStatus>({ status: 'idle' });
  const [shouldReload, setShouldReload] = useState(0);
  const [agentProgress, setAgentProgress] = useState<AgentProgressState>({
    isActive: false,
    steps: DEFAULT_STEPS.map(s => ({ ...s })),
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const listenersRef = useRef<Map<string, Set<(data: Record<string, unknown>) => void>>>(new Map());

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

        // Handle build events
        switch (msg.event) {
          case 'build_start':
            setBuildStatus({ status: 'building', projectId: msg.data.projectId as string });
            break;
          case 'build_complete':
            setBuildStatus({
              status: 'ready',
              projectId: msg.data.projectId as string,
              duration: msg.data.duration as number,
            });
            break;
          case 'build_error':
            setBuildStatus({
              status: 'error',
              projectId: msg.data.projectId as string,
              error: msg.data.error as string,
            });
            break;
          case 'reload':
            setShouldReload(prev => prev + 1);
            break;

          // Handle agent progress events
          case 'agent_progress': {
            const step = msg.data.step as AgentStepName | 'error';
            const status = msg.data.status as string;

            if (step === 'error') {
              // Error: mark current active step as error, deactivate
              setAgentProgress(prev => ({
                ...prev,
                isActive: false,
                steps: prev.steps.map(s =>
                  s.status === 'active' ? { ...s, status: 'error' as const } : s
                ),
              }));
            } else if (step === 'complete' && status === 'complete') {
              // All done — mark complete, then reset after delay
              setAgentProgress(prev => ({
                ...prev,
                steps: prev.steps.map(s => ({ ...s, status: 'complete' as const })),
                contextMetrics: msg.data.contextMetrics
                  ? { ...(prev.contextMetrics || {}), ...(msg.data.contextMetrics as Record<string, unknown>) } as AgentProgressState['contextMetrics']
                  : prev.contextMetrics,
              }));
              setTimeout(() => {
                setAgentProgress({
                  isActive: false,
                  steps: DEFAULT_STEPS.map(s => ({ ...s })),
                });
              }, 2000);
            } else if (status === 'active') {
              setAgentProgress(prev => {
                const stepIdx = prev.steps.findIndex(s => s.name === step);
                return {
                  isActive: true,
                  steps: prev.steps.map((s, i) =>
                    s.name === step
                      ? { ...s, status: 'active' as const }
                      : i < stepIdx && s.status !== 'error'
                        ? { ...s, status: 'complete' as const }
                        : s.status === 'active'
                          ? { ...s, status: 'complete' as const }
                          : s
                  ),
                  contextMetrics: prev.contextMetrics,
                };
              });
            } else if (status === 'complete') {
              setAgentProgress(prev => ({
                ...prev,
                steps: prev.steps.map(s =>
                  s.name === step ? { ...s, status: 'complete' as const } : s
                ),
                contextMetrics: msg.data.contextMetrics
                  ? { ...(prev.contextMetrics || {}), ...(msg.data.contextMetrics as Record<string, unknown>) } as AgentProgressState['contextMetrics']
                  : prev.contextMetrics,
              }));
            }
            break;
          }
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
  }, []);

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

  // Reset progress when starting a new request
  const resetProgress = useCallback(() => {
    setAgentProgress({
      isActive: true,
      steps: DEFAULT_STEPS.map(s => ({ ...s })),
    });
  }, []);

  return { isConnected, buildStatus, shouldReload, agentProgress, resetProgress, on };
}

